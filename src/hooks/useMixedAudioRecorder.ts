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
 * ChunkRecorder — simple raw PCM audio recorder that slices audio into 
 * fixed 2.5s chunks without using VAD for boundaries.
 */
class ChunkRecorder {
    private audioContext: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private buffer: number[] = [];
    private intervalId: any = null;

    constructor(
        private stream: MediaStream,
        private source: SpeakerSource,
        private onNewChunk: (source: SpeakerSource, chunk: Float32Array) => void,
        private setLevel: (level: number) => void
    ) {}

    start() {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.audioContext = new AudioContextClass({ sampleRate: 16000 });
            this.sourceNode = this.audioContext!.createMediaStreamSource(this.stream);
            
            // 4096 sample buffer size
            this.processor = this.audioContext!.createScriptProcessor(4096, 1, 1);
            
            this.sourceNode.connect(this.processor);
            this.processor.connect(this.audioContext!.destination);

            this.processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Calculate real-time level (RMS) for waveform visualizer
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                    this.buffer.push(inputData[i]);
                }
                const rms = Math.sqrt(sum / inputData.length);
                // Amplify level slightly for better visual responsiveness
                this.setLevel(rms);
            };

            // Every 2500ms, flush the buffer
            this.intervalId = setInterval(() => {
                if (this.buffer.length > 0) {
                    const chunk = new Float32Array(this.buffer);
                    this.buffer = [];
                    
                    // Energy check to avoid transcription of empty silent chunks
                    if (hasSignificantEnergy(chunk)) {
                        this.onNewChunk(this.source, chunk);
                    }
                }
            }, 2500);
            
            logger.info(`ChunkRecorder [${this.source}] started successfully.`);
        } catch (error) {
            logger.error(`Failed to start ChunkRecorder [${this.source}]:`, error);
        }
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.processor) {
            try {
                this.processor.disconnect();
            } catch {}
            this.processor.onaudioprocess = null;
            this.processor = null;
        }
        if (this.sourceNode) {
            try {
                this.sourceNode.disconnect();
            } catch {}
            this.sourceNode = null;
        }
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch {}
            this.audioContext = null;
        }
        this.buffer = [];
        logger.info(`ChunkRecorder [${this.source}] stopped and resources released.`);
    }
}

/**
 * Mixed audio recorder with Silero VAD (Utterance-based) or continuous Chunks mode.
 *
 * @param onNewChunk - Called when a complete utterance/chunk is ready for transcription
 * @param onInterviewerUtteranceEnd - Called when the interviewer finishes speaking (VAD only)
 * @param onInterviewerSpeechStart - Called when interviewer starts speaking (VAD only)
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
    
    // VAD Mode refs
    const micVADRef = useRef<any>(null);
    const systemVADRef = useRef<any>(null);

    // Chunks Mode refs
    const micRecorderRef = useRef<ChunkRecorder | null>(null);
    const systemRecorderRef = useRef<ChunkRecorder | null>(null);

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
            const settingsRes = await window.electronAPI.getSettings();
            const mode = settingsRes.success && settingsRes.settings ? settingsRes.settings.sttMode : 'vad';
            
            logger.info(`Starting audio recording (Mode: ${mode})...`);
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

            if (mode === 'chunks') {
                // Initialize Chunks Mode
                logger.info('Initializing Continuous Chunk Recorders...');
                
                if (micStreamRef.current) {
                    micRecorderRef.current = new ChunkRecorder(
                        micStreamRef.current,
                        'user',
                        (src, chunk) => onNewChunkRef.current?.(src, chunk),
                        (level) => setAudioLevels(prev => ({ ...prev, mic: Math.min(level * 5, 1) }))
                    );
                    micRecorderRef.current.start();
                }
                
                if (systemStreamRef.current && systemStreamRef.current.getAudioTracks().length > 0) {
                    systemRecorderRef.current = new ChunkRecorder(
                        systemStreamRef.current,
                        'interviewer',
                        (src, chunk) => onNewChunkRef.current?.(src, chunk),
                        (level) => setAudioLevels(prev => ({ ...prev, system: Math.min(level * 5, 1) }))
                    );
                    systemRecorderRef.current.start();
                }
            } else {
                // Initialize VAD Mode
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
                        onFrameProcessed: (_probabilities, frame) => {
                            // Compute real-time level (RMS) for bouncing waveform visualizer in VAD mode
                            let sum = 0;
                            for (let i = 0; i < frame.length; i++) {
                                sum += frame[i] * frame[i];
                            }
                            const rms = Math.sqrt(sum / frame.length);
                            setAudioLevels(prev => ({
                                ...prev,
                                [source === 'user' ? 'mic' : 'system']: Math.min(rms * 5, 1),
                            }));
                        },
                        onSpeechStart: () => {
                            logger.debug(`VAD [${source}]: Speech started detected`);
                            if (source === 'interviewer') {
                                onInterviewerSpeechStartRef.current?.();
                            }
                        },
                        onSpeechEnd: (audio: Float32Array) => {
                            logger.debug(`VAD [${source}]: Speech ended. Length: ${(audio.length / 16000).toFixed(1)}s`);
                            
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
        // Stop Chunks Mode Recorders
        if (micRecorderRef.current) {
            micRecorderRef.current.stop();
            micRecorderRef.current = null;
        }
        if (systemRecorderRef.current) {
            systemRecorderRef.current.stop();
            systemRecorderRef.current = null;
        }

        // Stop VAD Mode VADs
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
