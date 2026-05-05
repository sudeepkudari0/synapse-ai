import { useState, useCallback, useRef } from 'react';
import { logger } from '../lib/logger';

interface UseWhisperReturn {
    isModelLoading: boolean;
    isModelLoaded: boolean;
    modelError: string;
    transcribe: (audioData: Float32Array) => Promise<string>;
    loadModel: () => Promise<void>;
}

export function useWhisper(): UseWhisperReturn {
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [modelError, setModelError] = useState('');
    const isLoadingRef = useRef(false);

    const loadModel = useCallback(async () => {
        // Prevent multiple simultaneous loads
        if (isLoadingRef.current || isModelLoaded) {
            return;
        }

        isLoadingRef.current = true;
        setIsModelLoading(true);
        setModelError('');

        try {
            logger.info('Requesting to load Whisper model from main process...');
            if (!window.electronAPI || !window.electronAPI.whisper) {
                throw new Error('Electron API not available. Preload script may not have loaded correctly.');
            }

            const result = await window.electronAPI.whisper.loadModel('small.en');

            if (result.success) {
                logger.info('Whisper model loaded successfully');
                setIsModelLoaded(true);
            } else {
                logger.error('Failed to load model from main process:', result.error);
                throw new Error(result.error || 'Failed to load model');
            }
        } catch (error) {
            logger.error('Failed to load Whisper model:', error);
            setModelError(
                error instanceof Error ? error.message : 'Failed to load speech recognition model'
            );
            setIsModelLoaded(false);
        } finally {
            setIsModelLoading(false);
            isLoadingRef.current = false;
        }
    }, [isModelLoaded]);

    const transcribe = useCallback(
        async (audioData: Float32Array): Promise<string> => {
            if (!isModelLoaded) {
                throw new Error('Model not loaded. Call loadModel() first.');
            }

            try {
                if (audioData.length === 0) {
                    logger.warn('Empty audio data sent to transcribe');
                    return '';
                }
                logger.debug(`Sending ${audioData.length} samples to IPC transcriber...`);
                const startTime = performance.now();
                const result = await window.electronAPI.whisper.transcribe(audioData);
                const endTime = performance.now();

                logger.debug(`Transcription response received in ${(endTime - startTime).toFixed(0)}ms: success=${result.success}`);
                if (result.success) {
                    logger.info(`Transcribed text: "${result.text}"`);
                    return result.text;
                } else {
                    throw new Error(result.error || 'Transcription failed');
                }
            } catch (error) {
                logger.error('Transcription error at useWhisper:', error);
                throw error;
            }
        },
        [isModelLoaded]
    );

    return {
        isModelLoading,
        isModelLoaded,
        modelError,
        transcribe,
        loadModel,
    };
}
