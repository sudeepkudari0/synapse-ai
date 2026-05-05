import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../lib/logger';
import { MicVAD, utils } from '@ricky0123/vad-web';
import ortWasmThreadedMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmThreadedWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

interface UseMixedAudioRecorderReturn {
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    clearChunks: () => void;
}

export function useMixedAudioRecorder(
    onNewChunk?: (chunk: Float32Array) => void
): UseMixedAudioRecorderReturn {
    const LIVE_CHUNK_MS = 3000;
    const SAMPLE_RATE = 16000;
    const LIVE_CHUNK_SAMPLES = Math.floor((SAMPLE_RATE * LIVE_CHUNK_MS) / 1000);

    // Overlap: prepend last 1s of previous chunk to avoid word loss at boundaries
    const OVERLAP_MS = 1000;
    const OVERLAP_SAMPLES = Math.floor((SAMPLE_RATE * OVERLAP_MS) / 1000);

    const [isRecording, setIsRecording] = useState(false);
    const mixedStreamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const systemStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const vadRef = useRef<any>(null);
    const liveFramesRef = useRef<Float32Array[]>([]);
    const liveSamplesRef = useRef(0);
    const previousTailRef = useRef<Float32Array | null>(null);

    const onNewChunkRef = useRef(onNewChunk);
    
    useEffect(() => {
        onNewChunkRef.current = onNewChunk;
    }, [onNewChunk]);

    const emitBufferedLiveChunk = useCallback((force = false) => {
        const callback = onNewChunkRef.current;
        if (!callback) return;

        if (!force && liveSamplesRef.current < LIVE_CHUNK_SAMPLES) {
            return;
        }
        if (liveSamplesRef.current === 0) {
            return;
        }

        // Assemble raw chunk from buffered frames
        const rawChunk = new Float32Array(liveSamplesRef.current);
        let offset = 0;
        for (const frame of liveFramesRef.current) {
            rawChunk.set(frame, offset);
            offset += frame.length;
        }

        liveFramesRef.current = [];
        liveSamplesRef.current = 0;

        // Prepend overlap from the previous chunk so Whisper has word-boundary context
        let finalChunk: Float32Array;
        if (previousTailRef.current) {
            finalChunk = new Float32Array(previousTailRef.current.length + rawChunk.length);
            finalChunk.set(previousTailRef.current, 0);
            finalChunk.set(rawChunk, previousTailRef.current.length);
        } else {
            finalChunk = rawChunk;
        }

        // Save the tail of this chunk for the next overlap
        if (finalChunk.length > OVERLAP_SAMPLES) {
            previousTailRef.current = finalChunk.slice(-OVERLAP_SAMPLES);
        } else {
            previousTailRef.current = finalChunk.slice();
        }

        callback(finalChunk);
    }, []);

    const startRecording = useCallback(async () => {
        try {
            logger.info('Starting audio recording via VAD...');
            const assetBasePath = import.meta.env.BASE_URL || '/';
            // Get microphone stream
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000,
                },
            });
            micStreamRef.current = micStream;

            let recordingStream: MediaStream = micStream;

            try {
                const sources = await window.electronAPI.getDesktopSources();
                const screenSource = sources.find((s: any) => s.type === 'screen');

                if (screenSource) {
                    logger.info(`Found screen source: ${screenSource.id}. Attempting to capture system audio...`);
                    const systemStream = await (navigator.mediaDevices as any).getUserMedia({
                        audio: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: screenSource.id,
                            },
                        },
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: screenSource.id,
                                minWidth: 1280,
                                maxWidth: 1280,
                                minHeight: 720,
                                maxHeight: 720,
                            },
                        },
                    });
                    systemStreamRef.current = systemStream;

                    // Mix mic + system audio
                    const audioContext = new AudioContext({ sampleRate: 16000 });
                    audioContextRef.current = audioContext;

                    const micSource = audioContext.createMediaStreamSource(micStream);
                    const systemSource = audioContext.createMediaStreamSource(systemStream);

                    const micGain = audioContext.createGain();
                    const systemGain = audioContext.createGain();
                    micGain.gain.value = 1.0;
                    systemGain.gain.value = 0.5; // system audio needs more volume usually

                    const destination = audioContext.createMediaStreamDestination();
                    micSource.connect(micGain);
                    systemSource.connect(systemGain);
                    micGain.connect(destination);
                    systemGain.connect(destination);

                    recordingStream = destination.stream;
                    mixedStreamRef.current = recordingStream;
                    logger.info('System audio capture and mixing successful.');
                }
            } catch (err) {
                logger.warn('System audio unavailable, using mic only:', err);
                mixedStreamRef.current = micStream;
            }

            // Integration with @ricky0123/vad-web (Silero VAD)
            // micVAD will use the recording stream to trigger onSpeechEnd
            logger.info('Initializing Silero VAD...');
            vadRef.current = await MicVAD.new({
                baseAssetPath: assetBasePath,
                onnxWASMBasePath: assetBasePath,
                getStream: async () => recordingStream,
                resumeStream: async () => recordingStream,
                pauseStream: async (_stream: MediaStream) => {
                    // Keep tracks alive during pause so resume works with the same mixed source.
                },
                ortConfig: (ort) => {
                    ort.env.logLevel = 'error';
                    ort.env.wasm.wasmPaths = {
                        mjs: ortWasmThreadedMjsUrl,
                        wasm: ortWasmThreadedWasmUrl,
                    };
                },
                model: "v5",
                positiveSpeechThreshold: 0.35,
                negativeSpeechThreshold: 0.25,
                minSpeechMs: 250,
                preSpeechPadMs: 500,
                redemptionMs: 900,
                submitUserSpeechOnPause: true,
                onSpeechStart: () => {
                    logger.debug("VAD: Speech started detected");
                },
                onFrameProcessed: (probs: { isSpeech: number }, frame: Float32Array) => {
                    // Low-latency path: emit small chunks continuously while speech is active.
                    if (probs.isSpeech >= 0.25) {
                        liveFramesRef.current.push(frame.slice());
                        liveSamplesRef.current += frame.length;
                        emitBufferedLiveChunk(false);
                    } else if (liveSamplesRef.current > 0) {
                        // On silence, flush any trailing buffered speech quickly.
                        emitBufferedLiveChunk(true);
                    }
                },
                onSpeechEnd: (_audio: Float32Array) => {
                    logger.debug("VAD: Speech ended. Flushing live chunk buffer");
                    emitBufferedLiveChunk(true);
                },
                onVADMisfire: () => {
                    logger.debug("VAD: Misfire (speech too short)");
                }
            });

            vadRef.current.start();
            setIsRecording(true);
        } catch (error) {
            logger.error('Failed to start recording:', error);
            throw error;
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (vadRef.current) {
            vadRef.current.pause();
            vadRef.current.destroy();
            vadRef.current = null;
        }
        emitBufferedLiveChunk(true);
        liveFramesRef.current = [];
        liveSamplesRef.current = 0;
        previousTailRef.current = null;

        if (mixedStreamRef.current) {
            mixedStreamRef.current.getTracks().forEach((track) => track.stop());
            mixedStreamRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
        }
        if (systemStreamRef.current) {
            systemStreamRef.current.getTracks().forEach((track) => track.stop());
            systemStreamRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        setIsRecording(false);
    }, [emitBufferedLiveChunk]);

    const clearChunks = useCallback(() => {}, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        clearChunks,
    };
}
