import path from 'path';
import fs from 'fs';
import http from 'http';
import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { getSettings } from '../settings';

const isDebugEnabled = process.env.VITE_ENABLE_DEBUG_LOGS === 'true';
function debugLog(...args: any[]) {
    if (isDebugEnabled) {
        console.log('[MAIN DEBUG]', ...args);
    }
}

/** Always log important server lifecycle events regardless of debug flag. */
function serverLog(...args: any[]) {
    console.log('[Whisper Server]', ...args);
}

/**
 * Write a Float32Array of PCM samples to a 16-bit mono WAV file in memory
 * and return the Buffer (avoids disk I/O for the temp file).
 */
function createWavBuffer(samples: Float32Array, sampleRate: number): Buffer {
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

    return buffer;
}

/**
 * Resolve the base directory containing whisper binaries and models/.
 * Handles both development and packaged (electron-builder) modes.
 */
function resolveWhisperBasePath(): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'whisper');
    }
    return path.join(app.getAppPath(), 'native', 'whisper');
}

// ─── Server-backed Whisper Transcriber ───────────────────────────────────────

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 8178; // Non-standard port to avoid conflicts
const INFERENCE_PATH = '/inference';
const SERVER_STARTUP_TIMEOUT_MS = 30_000; // 30s to load model into GPU VRAM
const HEALTH_POLL_INTERVAL_MS = 300;

export class WhisperTranscriber {
    private modelName = 'small.en';
    private serverExePath = '';
    private modelPath = '';
    private isInitialized = false;
    private serverProcess: ChildProcess | null = null;
    private activeTranscription: Promise<{ text: string, words?: any[] }> | null = null;
    private transcriptionCounter = 0;
    private sttEngine: 'whisper' | 'moonshine' = 'moonshine';

    async initialize(modelName: string = 'small.en'): Promise<void> {
        const currentEngine = getSettings().sttEngine || 'moonshine';

        // Already initialized with same model & engine — skip.
        if (this.isInitialized && this.modelName === modelName && this.sttEngine === currentEngine && this.serverProcess) {
            debugLog(`STT server already running (${currentEngine} - ${this.modelName})`);
            return;
        }

        // If switching models or engine, tear down old server first.
        if (this.serverProcess && (this.modelName !== modelName || this.sttEngine !== currentEngine)) {
            await this.dispose();
        }

        this.modelName = modelName;
        this.sttEngine = currentEngine;
        
        const basePath = resolveWhisperBasePath();
        const exeName = this.sttEngine === 'moonshine' ? 'moonshine-server.exe' : 'whisper-server.exe';
        this.serverExePath = path.join(basePath, exeName);
        
        if (this.sttEngine === 'moonshine') {
            this.modelPath = 'moonshine-streaming-medium';
        } else {
            // Whisper.cpp model validation
            const modelsDir = path.join(app.getPath('userData'), 'whisper-models');
            this.modelPath = path.join(modelsDir, `ggml-${modelName}.bin`);
            
            if (!fs.existsSync(this.modelPath)) {
                throw new Error(`Model file not found at ${this.modelPath}. Please download it in settings.`);
            }
        }

        // Validate server binary exists
        if (!fs.existsSync(this.serverExePath)) {
            throw new Error(
                `${exeName} not found at ${this.serverExePath}. ` +
                `Please compile the server first.`
            );
        }

        // Start the server and wait for it to become ready
        await this.startServer();
        this.isInitialized = true;
        serverLog(`Ready — engine "${this.sttEngine}", model "${modelName}" loaded, listening on ${SERVER_HOST}:${SERVER_PORT}`);
    }

    /**
     * Launch whisper-server.exe as a background child process and wait
     * until it is ready to accept HTTP requests.
     */
    private async startServer(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const args = [
                '--host', SERVER_HOST,
                '--port', SERVER_PORT.toString(),
            ];

            serverLog(`Starting: moonshine-server.exe ${args.join(' ')}`);

            const proc = spawn(this.serverExePath, args, {
                cwd: path.dirname(this.serverExePath),
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            this.serverProcess = proc;

            // Collect stderr for debugging (whisper logs go to stderr)
            proc.stderr?.on('data', (chunk: Buffer) => {
                const msg = chunk.toString().trim();
                if (msg) debugLog(`[server stderr] ${msg}`);
            });

            proc.stdout?.on('data', (chunk: Buffer) => {
                const msg = chunk.toString().trim();
                if (msg) debugLog(`[server stdout] ${msg}`);
            });

            proc.on('error', (err) => {
                serverLog(`Process error: ${err.message}`);
                this.serverProcess = null;
                reject(new Error(`Failed to start moonshine-server.exe: ${err.message}`));
            });

            proc.on('exit', (code, signal) => {
                serverLog(`Exited (code=${code}, signal=${signal})`);
                if (this.serverProcess === proc) {
                    this.serverProcess = null;
                    this.isInitialized = false;
                }
            });

            // Poll the server until it responds to a health check
            const startTime = Date.now();

            const pollHealth = () => {
                if (Date.now() - startTime > SERVER_STARTUP_TIMEOUT_MS) {
                    this.killServer();
                    reject(new Error(
                        `moonshine-server.exe did not become ready within ${SERVER_STARTUP_TIMEOUT_MS / 1000}s. ` +
                        `Check that the model file is valid and CUDA is working.`
                    ));
                    return;
                }

                // Try a simple GET to see if the server is listening
                const req = http.get(
                    `http://${SERVER_HOST}:${SERVER_PORT}/`,
                    { timeout: 1000 },
                    (res) => {
                        // Any response (even 404) means the server is up
                        res.resume(); // drain the response
                        serverLog(`Server is up (startup took ${Date.now() - startTime}ms)`);
                        resolve();
                    }
                );

                req.on('error', () => {
                    // Server not ready yet — retry
                    setTimeout(pollHealth, HEALTH_POLL_INTERVAL_MS);
                });

                req.on('timeout', () => {
                    req.destroy();
                    setTimeout(pollHealth, HEALTH_POLL_INTERVAL_MS);
                });
            };

            // Give the process a moment to start before first poll
            setTimeout(pollHealth, 500);
        });
    }

    async transcribe(audioData: Float32Array, prompt?: string): Promise<{ text: string, words?: any[] }> {
        if (!this.isInitialized || !this.serverProcess) {
            throw new Error('Whisper server not running. Call initialize() first.');
        }

        if (audioData.length === 0) {
            return { text: '' };
        }

        // Serialize inference calls — one at a time to avoid overwhelming the server.
        const previous = this.activeTranscription ?? Promise.resolve({ text: '' });
        const current = previous
            .catch(() => ({ text: '' }))
            .then(() => this.sendToServer(audioData, prompt));

        this.activeTranscription = current;
        return current;
    }

    /**
     * Send audio to the whisper-server via HTTP POST multipart/form-data
     * to the /inference endpoint and return the transcribed text.
     */
    private async sendToServer(audioData: Float32Array, prompt?: string): Promise<{ text: string, words?: any[] }> {
        const id = ++this.transcriptionCounter;
        const startTime = Date.now();

        // Create WAV in memory (no disk I/O needed)
        const wavBuffer = createWavBuffer(audioData, 16000);

        // Build multipart/form-data payload manually (no external deps needed)
        const boundary = `----WhisperBoundary${Date.now()}`;
        const parts: Buffer[] = [];

        // File field: "file"
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
            `Content-Type: audio/wav\r\n\r\n`
        ));
        parts.push(wavBuffer);
        parts.push(Buffer.from('\r\n'));

        // Response format field
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
            `verbose_json\r\n`
        ));

        // Initial prompt field for prefix conditioning
        if (prompt) {
            parts.push(Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
                `${prompt}\r\n`
            ));
        }

        // Language field
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="language"\r\n\r\n` +
            `en\r\n`
        ));

        // Temperature field (0 = greedy, fastest)
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="temperature"\r\n\r\n` +
            `0.0\r\n`
        ));

        // Closing boundary
        parts.push(Buffer.from(`--${boundary}--\r\n`));

        const body = Buffer.concat(parts);

        debugLog(`[Whisper #${id}] sending ${(wavBuffer.length / 1024).toFixed(1)} KB WAV to server...`);

        const result = await new Promise<{ text: string, words?: any[] }>((resolve, reject) => {
            const req = http.request(
                {
                    hostname: SERVER_HOST,
                    port: SERVER_PORT,
                    path: INFERENCE_PATH,
                    method: 'POST',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': body.length,
                    },
                    timeout: 30_000,
                },
                (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            const text = (json.text ?? '').trim();
                            let words: any[] = [];
                            
                            if (json.segments && Array.isArray(json.segments)) {
                                for (const segment of json.segments) {
                                    const tokens = segment.words || segment.tokens || [];
                                    for (const token of tokens) {
                                        words.push({
                                            word: (token.word || token.text || '').trim(),
                                            start: token.start,
                                            end: token.end
                                        });
                                    }
                                }
                            }
                            
                            resolve({ text, words: words.length > 0 ? words : undefined });
                        } catch {
                            // If not JSON, try to use raw text
                            resolve({ text: data.trim() });
                        }
                    });
                }
            );

            req.on('error', (err) => {
                reject(new Error(`Whisper server request failed: ${err.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Whisper server request timed out'));
            });

            req.write(body);
            req.end();
        });

        const elapsed = Date.now() - startTime;
        const durationMs = (audioData.length / 16000) * 1000;
        debugLog(
            `[Whisper #${id}] transcribed in ${elapsed}ms ` +
            `(audio: ${Math.round(durationMs)}ms, RTF: ${(elapsed / durationMs).toFixed(2)}): "${result.text}"`
        );

        return result;
    }

    getStatus() {
        return {
            isLoaded: this.isInitialized,
            modelName: this.modelName,
            backend: 'whisper-server-cuda',
        };
    }

    private killServer(): void {
        if (this.serverProcess) {
            try {
                this.serverProcess.kill('SIGTERM');
                // On Windows, SIGTERM may not work — force kill
                setTimeout(() => {
                    if (this.serverProcess && !this.serverProcess.killed) {
                        this.serverProcess.kill('SIGKILL');
                    }
                }, 2000);
            } catch {
                // Process may have already exited
            }
            this.serverProcess = null;
        }
    }

    async dispose(): Promise<void> {
        serverLog('Disposing — shutting down server...');
        const procToKill = this.serverProcess;
        this.isInitialized = false;
        this.activeTranscription = null;
        this.killServer();
        
        // Wait briefly for the process to actually exit to free the port
        if (procToKill) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        serverLog('Disposed');
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
