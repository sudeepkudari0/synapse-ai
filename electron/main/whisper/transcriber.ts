import path from 'path';
import { app } from 'electron';

const isDebugEnabled = process.env.VITE_ENABLE_DEBUG_LOGS === 'true';
function debugLog(...args: any[]) {
    if (isDebugEnabled) {
        console.log('[MAIN DEBUG]', ...args);
    }
}

type ASROutput = {
    text?: string;
};

type ASRPipeline = ((audio: Float32Array, options?: Record<string, unknown>) => Promise<ASROutput>) & {
    dispose?: () => Promise<void>;
};

type TransformersModule = {
    env: {
        cacheDir?: string;
        allowRemoteModels?: boolean;
        allowLocalModels?: boolean;
    };
    pipeline: (
        task: 'automatic-speech-recognition',
        model: string,
        options?: Record<string, unknown>
    ) => Promise<ASRPipeline>;
};

// Preserve native runtime import() in CommonJS output for ESM-only deps.
const dynamicImportAtRuntime = new Function('specifier', 'return import(specifier)') as
    (specifier: string) => Promise<TransformersModule>;

function resolveTransformersModel(modelName: string): string {
    switch (modelName) {
        case 'tiny.en':
            return 'Xenova/whisper-tiny.en';
        case 'base.en':
            return 'Xenova/whisper-base.en';
        case 'small.en':
            return 'Xenova/whisper-small.en';
        default:
            // Keep prior default compatible with existing calls.
            return 'Xenova/whisper-base.en';
    }
}

export class WhisperTranscriber {
    private isInitialized = false;
    private modelName = 'base.en';
    private modelId = resolveTransformersModel('base.en');
    private transcriber: ASRPipeline | null = null;
    private initializingPromise: Promise<void> | null = null;
    private activeTranscription: Promise<string> | null = null;

    async initialize(modelName: string = 'base.en'): Promise<void> {
        const requestedModelId = resolveTransformersModel(modelName);

        // Already initialized with same model.
        if (this.isInitialized && this.transcriber && this.modelId === requestedModelId) {
            debugLog(`Whisper pipeline already initialized (${this.modelId})`);
            return;
        }

        // Re-initialize when model changes.
        if (this.transcriber && this.modelId !== requestedModelId) {
            await this.dispose();
        }

        this.modelName = modelName;
        this.modelId = requestedModelId;

        if (!this.initializingPromise) {
            this.initializingPromise = this.buildPipeline(this.modelId)
                .finally(() => {
                    this.initializingPromise = null;
                });
        }

        await this.initializingPromise;
    }

    private async buildPipeline(modelId: string): Promise<void> {
        try {
            debugLog(`Initializing persistent ASR pipeline (${modelId})`);

            const transformers = await dynamicImportAtRuntime('@xenova/transformers');

            // Persist model cache under app data so restarts are faster.
            const cacheDir = path.join(app.getPath('userData'), 'transformers-cache');
            transformers.env.cacheDir = cacheDir;
            transformers.env.allowLocalModels = true;
            transformers.env.allowRemoteModels = true;

            // quantized=true is default and important for latency/memory on CPU.
            this.transcriber = await transformers.pipeline(
                'automatic-speech-recognition',
                modelId,
                { quantized: true }
            );

            this.isInitialized = true;
            debugLog(`ASR pipeline initialized (${modelId})`);
        } catch (error) {
            this.isInitialized = false;
            this.transcriber = null;
            throw new Error(
                `Failed to initialize persistent ASR pipeline (${modelId}): ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async transcribe(audioData: Float32Array): Promise<string> {
        if (!this.isInitialized || !this.transcriber) {
            throw new Error('Whisper model not initialized. Call initialize() first.');
        }

        if (audioData.length === 0) {
            return '';
        }

        // Serialize inference calls against the single persistent pipeline.
        const previous = this.activeTranscription ?? Promise.resolve('');
        const current = previous
            .catch(() => '')
            .then(async () => {
                if (!this.transcriber) {
                    throw new Error('ASR pipeline unavailable.');
                }

                const startTime = Date.now();
                const output = await this.transcriber(audioData, {
                    language: 'en',
                    task: 'transcribe',
                    return_timestamps: false,
                });

                const text = output?.text?.trim() ?? '';
                debugLog(`ASR chunk transcribed in ${Date.now() - startTime}ms: "${text}"`);
                return text;
            });

        this.activeTranscription = current;
        return current;
    }

    getStatus() {
        return {
            isLoaded: this.isInitialized,
            modelName: this.modelName,
            modelId: this.modelId,
            backend: 'transformers-persistent',
        };
    }

    async dispose(): Promise<void> {
        this.isInitialized = false;
        this.activeTranscription = null;

        if (this.transcriber?.dispose) {
            try {
                await this.transcriber.dispose();
            } catch (error) {
                debugLog('ASR pipeline dispose warning:', error);
            }
        }
        this.transcriber = null;
    }
}

// Singleton instance
let transcriber: WhisperTranscriber | null = null;

export function getTranscriber(): WhisperTranscriber {
    if (!transcriber) {
        transcriber = new WhisperTranscriber();
    }
    return transcriber;
}
