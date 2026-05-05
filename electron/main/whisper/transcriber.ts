import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';
import { spawn } from 'child_process';

const isDebugEnabled = process.env.VITE_ENABLE_DEBUG_LOGS === 'true';
function debugLog(...args: any[]) {
    if (isDebugEnabled) {
        console.log('[MAIN DEBUG]', ...args);
    }
}

/**
 * Write a Float32Array of PCM samples to a 16-bit mono WAV file.
 */
function writeWav(samples: Float32Array, sampleRate: number, filePath: string): void {
    const numSamples = samples.length;
    const bytesPerSample = 2; // 16-bit PCM
    const dataSize = numSamples * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);           // subchunk size
    buffer.writeUInt16LE(1, 20);            // PCM format
    buffer.writeUInt16LE(1, 22);            // mono
    buffer.writeUInt32LE(sampleRate, 24);   // sample rate
    buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
    buffer.writeUInt16LE(bytesPerSample, 32); // block align
    buffer.writeUInt16LE(16, 34);           // bits per sample

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Convert float32 [-1,1] to int16
    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
    }

    fs.writeFileSync(filePath, buffer);
}

/**
 * Resolve the base directory containing whisper.exe and models/.
 * Handles both development and packaged (electron-builder) modes.
 */
function resolveWhisperBasePath(): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'whisper');
    }
    return path.join(app.getAppPath(), 'native', 'whisper');
}

export class WhisperTranscriber {
    private modelName = 'base.en';
    private whisperExePath = '';
    private modelPath = '';
    private isInitialized = false;
    private activeTranscription: Promise<string> | null = null;
    private transcriptionCounter = 0;

    async initialize(modelName: string = 'base.en'): Promise<void> {
        // Already initialized with same model — skip.
        if (this.isInitialized && this.modelName === modelName) {
            debugLog(`Whisper (whisper.cpp) already initialized (${this.modelName})`);
            return;
        }

        this.modelName = modelName;
        const basePath = resolveWhisperBasePath();
        this.whisperExePath = path.join(basePath, 'whisper.exe');
        this.modelPath = path.join(basePath, 'models', `ggml-${modelName}.bin`);

        // Validate binary exists
        if (!fs.existsSync(this.whisperExePath)) {
            throw new Error(
                `whisper.exe not found at ${this.whisperExePath}. ` +
                `Run the setup script or place the binary in native/whisper/.`
            );
        }

        // Validate model file exists
        if (!fs.existsSync(this.modelPath)) {
            throw new Error(
                `Model file not found at ${this.modelPath}. ` +
                `Run: bun run scripts/download-base-model.ps1`
            );
        }

        // Quick dry-run: invoke whisper.exe with --help to verify the binary is executable.
        try {
            await new Promise<void>((resolve, reject) => {
                const proc = spawn(this.whisperExePath, ['--help'], {
                    windowsHide: true,
                    timeout: 5000,
                });
                proc.on('close', () => resolve());
                proc.on('error', (err) => reject(err));
            });
        } catch (error) {
            throw new Error(
                `whisper.exe dry-run failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        this.isInitialized = true;
        debugLog(`Whisper (whisper.cpp) initialized — binary: ${this.whisperExePath}, model: ${this.modelPath}`);
    }

    async transcribe(audioData: Float32Array): Promise<string> {
        if (!this.isInitialized) {
            throw new Error('Whisper model not initialized. Call initialize() first.');
        }

        if (audioData.length === 0) {
            return '';
        }

        // Serialize inference calls — one at a time.
        const previous = this.activeTranscription ?? Promise.resolve('');
        const current = previous
            .catch(() => '')
            .then(() => this.runWhisperCli(audioData));

        this.activeTranscription = current;
        return current;
    }

    private async runWhisperCli(audioData: Float32Array): Promise<string> {
        const id = ++this.transcriptionCounter;
        const tempDir = app.getPath('temp');
        const tempWavPath = path.join(tempDir, `whisper_chunk_${id}_${Date.now()}.wav`);

        try {
            const startTime = Date.now();

            // Write PCM data to a temporary WAV file
            writeWav(audioData, 16000, tempWavPath);

            // Spawn whisper.exe
            const args = [
                '-m', this.modelPath,
                '-f', tempWavPath,
                '-l', 'en',
                '-nt',              // no timestamps
                '-t', '4',         // threads
                '--no-gpu',        // CPU-only build, avoid spurious GPU logs
            ];

            debugLog(`[Whisper #${id}] spawning: whisper.exe ${args.join(' ')}`);

            const text = await new Promise<string>((resolve, reject) => {
                let stdout = '';
                let stderr = '';

                const proc = spawn(this.whisperExePath, args, {
                    windowsHide: true,
                    // 30 second timeout as safety net
                    timeout: 30_000,
                });

                proc.stdout.on('data', (chunk: Buffer) => {
                    stdout += chunk.toString();
                });

                proc.stderr.on('data', (chunk: Buffer) => {
                    stderr += chunk.toString();
                });

                proc.on('error', (err) => {
                    reject(new Error(`whisper.exe process error: ${err.message}`));
                });

                proc.on('close', (code) => {
                    if (code !== 0) {
                        debugLog(`[Whisper #${id}] exited with code ${code}. stderr: ${stderr}`);
                        // whisper.exe sometimes returns non-zero but still produces output
                    }

                    // Parse stdout: whisper.exe -nt outputs plain text, one line per segment.
                    // Lines may have leading/trailing whitespace.
                    const lines = stdout
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);

                    // Filter out whisper system log lines (e.g. "whisper_init_from_file_with_params_no_state: ...")
                    const transcriptLines = lines.filter(
                        line => !line.startsWith('whisper_') &&
                                !line.startsWith('ggml_') &&
                                !line.startsWith('main:') &&
                                !line.startsWith('system_info:') &&
                                !line.startsWith('operator():')
                    );

                    const result = transcriptLines.join(' ').trim();
                    resolve(result);
                });
            });

            const elapsed = Date.now() - startTime;
            const durationMs = (audioData.length / 16000) * 1000;
            debugLog(
                `[Whisper #${id}] transcribed in ${elapsed}ms ` +
                `(audio: ${Math.round(durationMs)}ms, RTF: ${(elapsed / durationMs).toFixed(2)}): "${text}"`
            );

            return text;
        } finally {
            // Clean up temp WAV file
            try {
                if (fs.existsSync(tempWavPath)) {
                    fs.unlinkSync(tempWavPath);
                }
            } catch {
                debugLog(`[Whisper #${id}] failed to delete temp file: ${tempWavPath}`);
            }
        }
    }

    getStatus() {
        return {
            isLoaded: this.isInitialized,
            modelName: this.modelName,
            backend: 'whisper-cpp-native',
        };
    }

    async dispose(): Promise<void> {
        this.isInitialized = false;
        this.activeTranscription = null;
        debugLog('Whisper (whisper.cpp) disposed');
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
