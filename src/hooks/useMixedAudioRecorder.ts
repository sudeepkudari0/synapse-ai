import { useRef, useCallback, useEffect, useState } from 'react';
import { logger } from '../lib/logger';
import { MicVAD } from '@ricky0123/vad-web';
import ortWasmThreadedMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmThreadedWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { hasSignificantEnergy } from '../lib/hallucination-filter';

export type SpeakerSource = 'user' | 'interviewer';

interface UseMixedAudioRecorderReturn {
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    clearChunks: () => void;
    audioLevels: { mic: number; system: number };
}

/**
 * Mixed audio recorder with Silero VAD (Utterance-based).
 *
 * @param onNewChunk - Called when a complete utterance is ready for transcription
 * @param onInterviewerUtteranceEnd - Called when the interviewer finishes speaking
 * @param onInterviewerSpeechStart - Called when interviewer starts speaking
 */
export function useMixedAudioRecorder(
    onNewChunk?: (source: SpeakerSource, chunk: Float32Array) => void,
    onInterviewerUtteranceEnd?: () => void,
    onInterviewerSpeechStart?: () => void
): UseMixedAudioRecorderReturn {
    const [audioLevels, setAudioLevels] = useState({ mic: 0, system: 0 });
    const audioLevelDecayRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const systemStreamRef = useRef<MediaStream | null>(null);
    
    const micVADRef = useRef<any>(null);
    const systemVADRef = useRef<any>(null);

    const onNewChunkRef = useRef(onNewChunk);
    const onInterviewerUtteranceEndRef = useRef(onInterviewerUtteranceEnd);
    const onInterviewerSpeechStartRef = useRef(onInterviewerSpeechStart);
    
    useEffect(() => {
        onNewChunkRef.current = onNewChunk;
    }, [onNewChunk]);

    useEffect(() => {
        onInterviewerUtteranceEndRef.current = onInterviewerUtteranceEnd;
    }, [onInterviewerUtteranceEnd]);

    useEffect(() => {
        onInterviewerSpeechStartRef.current = onInterviewerSpeechStart;
    }, [onInterviewerSpeechStart]);

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

            const createVAD = async (stream: MediaStream, source: SpeakerSource) => {
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
                    positiveSpeechThreshold: 0.5,
                    negativeSpeechThreshold: 0.35,
                    minSpeechMs: 300,
                    preSpeechPadMs: 500,
                    redemptionMs: 600,
                    submitUserSpeechOnPause: true,
                    onSpeechStart: () => {
                        logger.debug(`VAD [${source}]: Speech started detected`);
                        if (source === 'interviewer') {
                            onInterviewerSpeechStartRef.current?.();
                        }
                    },
                    onSpeechEnd: (audio: Float32Array) => {
                        logger.debug(`VAD [${source}]: Speech ended. Length: ${(audio.length / 16000).toFixed(1)}s`);
                        
                        // Compute RMS level for waveform visualization
                        const rms = computeRMS(audio);
                        setAudioLevels(prev => ({
                            ...prev,
                            [source === 'user' ? 'mic' : 'system']: Math.min(rms * 5, 1), // Normalize to 0-1
                        }));

                        // Energy-based pre-filter to catch silent/noise frames that VAD might have misclassified
                        if (hasSignificantEnergy(audio)) {
                            onNewChunkRef.current?.(source, audio);
                        } else {
                            logger.debug(`VAD [${source}]: Discarding utterance due to low energy`);
                        }

                        if (source === 'interviewer') {
                            onInterviewerUtteranceEndRef.current?.();
                        }
                    },
                    onVADMisfire: () => {
                        logger.debug(`VAD [${source}]: Misfire (speech too short)`);
                    }
                });
            };

            logger.info('Initializing Silero VADs...');
            
            if (micStreamRef.current) {
                micVADRef.current = await createVAD(micStreamRef.current, 'user');
                micVADRef.current.start();
            }
            
            if (systemStreamRef.current && systemStreamRef.current.getAudioTracks().length > 0) {
                systemVADRef.current = await createVAD(systemStreamRef.current, 'interviewer');
                systemVADRef.current.start();
            }

            // Decay audio levels over time to create smooth falloff
            audioLevelDecayRef.current = setInterval(() => {
                setAudioLevels(prev => ({
                    mic: prev.mic > 0.01 ? prev.mic * 0.85 : 0,
                    system: prev.system > 0.01 ? prev.system * 0.85 : 0,
                }));
            }, 100);

        } catch (error) {
            logger.error('Failed to start recording:', error);
            throw error;
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (micVADRef.current) {
            micVADRef.current.pause(); // Setting submitUserSpeechOnPause to true ensures pending audio is processed
            micVADRef.current.destroy();
            micVADRef.current = null;
        }
        if (systemVADRef.current) {
            systemVADRef.current.pause();
            systemVADRef.current.destroy();
            systemVADRef.current = null;
        }
        
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
        }
        if (systemStreamRef.current) {
            systemStreamRef.current.getTracks().forEach((track) => track.stop());
            systemStreamRef.current = null;
        }

        if (audioLevelDecayRef.current) {
            clearInterval(audioLevelDecayRef.current);
            audioLevelDecayRef.current = null;
        }
        setAudioLevels({ mic: 0, system: 0 });

    }, []);

    const clearChunks = useCallback(() => {}, []);

    return {
        startRecording,
        stopRecording,
        clearChunks,
        audioLevels,
    };
}

/** Compute RMS (Root Mean Square) of an audio buffer */
function computeRMS(buffer: Float32Array): number {
    let sum = 0;
    // Sample every 4th value for performance
    const step = 4;
    for (let i = 0; i < buffer.length; i += step) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / (buffer.length / step));
}
