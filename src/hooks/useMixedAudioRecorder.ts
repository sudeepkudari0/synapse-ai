import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../lib/logger';
import { MicVAD } from '@ricky0123/vad-web';
import ortWasmThreadedMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmThreadedWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

export type SpeakerSource = 'user' | 'interviewer';

interface UseMixedAudioRecorderReturn {
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    clearChunks: () => void;
}

export function useMixedAudioRecorder(
    onNewChunk?: (source: SpeakerSource, chunk: Float32Array) => void
): UseMixedAudioRecorderReturn {
    const LIVE_CHUNK_MS = 3000;
    const SAMPLE_RATE = 16000;
    const LIVE_CHUNK_SAMPLES = Math.floor((SAMPLE_RATE * LIVE_CHUNK_MS) / 1000);

    // Overlap: prepend last 1s of previous chunk to avoid word loss at boundaries
    const OVERLAP_MS = 1000;
    const OVERLAP_SAMPLES = Math.floor((SAMPLE_RATE * OVERLAP_MS) / 1000);

    const [isRecording, setIsRecording] = useState(false);
    
    const micStreamRef = useRef<MediaStream | null>(null);
    const systemStreamRef = useRef<MediaStream | null>(null);
    
    const micVADRef = useRef<any>(null);
    const systemVADRef = useRef<any>(null);

    const micLiveFramesRef = useRef<Float32Array[]>([]);
    const micLiveSamplesRef = useRef(0);
    const micPreviousTailRef = useRef<Float32Array | null>(null);

    const sysLiveFramesRef = useRef<Float32Array[]>([]);
    const sysLiveSamplesRef = useRef(0);
    const sysPreviousTailRef = useRef<Float32Array | null>(null);

    const onNewChunkRef = useRef(onNewChunk);
    
    useEffect(() => {
        onNewChunkRef.current = onNewChunk;
    }, [onNewChunk]);

    const createEmitFunction = (
        source: SpeakerSource,
        liveFramesRef: React.MutableRefObject<Float32Array[]>,
        liveSamplesRef: React.MutableRefObject<number>,
        previousTailRef: React.MutableRefObject<Float32Array | null>
    ) => {
        return (force = false) => {
            const callback = onNewChunkRef.current;
            if (!callback) return;

            if (!force && liveSamplesRef.current < LIVE_CHUNK_SAMPLES) return;
            if (liveSamplesRef.current === 0) return;

            const rawChunk = new Float32Array(liveSamplesRef.current);
            let offset = 0;
            for (const frame of liveFramesRef.current) {
                rawChunk.set(frame, offset);
                offset += frame.length;
            }

            liveFramesRef.current = [];
            liveSamplesRef.current = 0;

            let finalChunk: Float32Array;
            if (previousTailRef.current) {
                finalChunk = new Float32Array(previousTailRef.current.length + rawChunk.length);
                finalChunk.set(previousTailRef.current, 0);
                finalChunk.set(rawChunk, previousTailRef.current.length);
            } else {
                finalChunk = rawChunk;
            }

            if (finalChunk.length > OVERLAP_SAMPLES) {
                previousTailRef.current = finalChunk.slice(-OVERLAP_SAMPLES);
            } else {
                previousTailRef.current = finalChunk.slice();
            }

            callback(source, finalChunk);
        };
    };

    const emitMicChunk = useCallback(createEmitFunction('user', micLiveFramesRef, micLiveSamplesRef, micPreviousTailRef), []);
    const emitSysChunk = useCallback(createEmitFunction('interviewer', sysLiveFramesRef, sysLiveSamplesRef, sysPreviousTailRef), []);

    const startRecording = useCallback(async () => {
        try {
            logger.info('Starting audio recording via VAD...');
            const assetBasePath = import.meta.env.BASE_URL || '/';
            
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000,
                },
            });
            micStreamRef.current = micStream;

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
                    
                    // We only need the audio track for VAD processing
                    const sysAudioStream = new MediaStream(systemStream.getAudioTracks());
                    systemStreamRef.current = sysAudioStream;
                    
                    // Stop the video track as we don't use it
                    systemStream.getVideoTracks().forEach((track: any) => track.stop());
                    
                    logger.info('System audio capture successful.');
                }
            } catch (err) {
                logger.warn('System audio unavailable:', err);
            }

            const createVAD = async (stream: MediaStream, source: SpeakerSource, emitChunk: (force?: boolean) => void) => {
                return await MicVAD.new({
                    baseAssetPath: assetBasePath,
                    onnxWASMBasePath: assetBasePath,
                    getStream: async () => stream,
                    resumeStream: async () => stream,
                    pauseStream: async () => {},
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
                        logger.debug(`VAD [${source}]: Speech started detected`);
                        if (source === 'user') {
                            micPreviousTailRef.current = null;
                        } else {
                            sysPreviousTailRef.current = null;
                        }
                    },
                    onFrameProcessed: (probs: { isSpeech: number }, frame: Float32Array) => {
                        if (probs.isSpeech >= 0.25) {
                            if (source === 'user') {
                                micLiveFramesRef.current.push(frame.slice());
                                micLiveSamplesRef.current += frame.length;
                            } else {
                                sysLiveFramesRef.current.push(frame.slice());
                                sysLiveSamplesRef.current += frame.length;
                            }
                            emitChunk(false);
                        } else if ((source === 'user' ? micLiveSamplesRef.current : sysLiveSamplesRef.current) > 0) {
                            emitChunk(true);
                        }
                    },
                    onSpeechEnd: () => {
                        logger.debug(`VAD [${source}]: Speech ended. Flushing live chunk buffer`);
                        emitChunk(true);
                        if (source === 'user') {
                            micPreviousTailRef.current = null;
                        } else {
                            sysPreviousTailRef.current = null;
                        }
                    },
                    onVADMisfire: () => {
                        logger.debug(`VAD [${source}]: Misfire (speech too short)`);
                    }
                });
            };

            logger.info('Initializing Silero VADs...');
            
            if (micStreamRef.current) {
                micVADRef.current = await createVAD(micStreamRef.current, 'user', emitMicChunk);
                micVADRef.current.start();
            }
            
            if (systemStreamRef.current && systemStreamRef.current.getAudioTracks().length > 0) {
                systemVADRef.current = await createVAD(systemStreamRef.current, 'interviewer', emitSysChunk);
                systemVADRef.current.start();
            }

            setIsRecording(true);
        } catch (error) {
            logger.error('Failed to start recording:', error);
            throw error;
        }
    }, [emitMicChunk, emitSysChunk]);

    const stopRecording = useCallback(() => {
        if (micVADRef.current) {
            micVADRef.current.pause();
            micVADRef.current.destroy();
            micVADRef.current = null;
        }
        if (systemVADRef.current) {
            systemVADRef.current.pause();
            systemVADRef.current.destroy();
            systemVADRef.current = null;
        }
        
        emitMicChunk(true);
        emitSysChunk(true);
        
        micLiveFramesRef.current = [];
        micLiveSamplesRef.current = 0;
        micPreviousTailRef.current = null;

        sysLiveFramesRef.current = [];
        sysLiveSamplesRef.current = 0;
        sysPreviousTailRef.current = null;

        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
        }
        if (systemStreamRef.current) {
            systemStreamRef.current.getTracks().forEach((track) => track.stop());
            systemStreamRef.current = null;
        }

        setIsRecording(false);
    }, [emitMicChunk, emitSysChunk]);

    const clearChunks = useCallback(() => {}, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        clearChunks,
    };
}
