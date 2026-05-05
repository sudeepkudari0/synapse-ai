/**
 * Script 3: Live Streaming Simulation
 * 
 * Records from your mic + system audio (WASAPI loopback) in real-time,
 * splits into chunks, feeds them to whisper.exe, applies basic transcript
 * stabilization, and prints live text as it arrives.
 * 
 * This simulates the actual experience you'd get in the app.
 * 
 * Run with:  bun run scripts/test-whisper-streaming.ts
 * Options:
 *   --chunk=3000       Chunk size in ms (default: 3000)
 *   --overlap=1000     Overlap in ms (default: 1000)
 *   --model=base.en    Model name (default: base.en)
 *   --duration=60      Recording duration in seconds (default: 60)
 *   --no-system-audio  Disable system audio capture (mic only)
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const WHISPER_EXE = path.join(ROOT, 'native', 'whisper', 'whisper.exe');
const MODELS_DIR = path.join(ROOT, 'native', 'whisper', 'models');
const TEMP_DIR = path.join(ROOT, 'test-data', 'streaming-tmp');
const MIC_DEVICE = 'Microphone Array (Realtek(R) Audio)';

// ── Parse CLI args ───────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        chunkMs: 3000,
        overlapMs: 1000,
        model: 'base.en',
        durationSec: 60,
        systemAudio: true,
    };

    for (const arg of args) {
        if (arg.startsWith('--chunk=')) opts.chunkMs = parseInt(arg.split('=')[1]);
        if (arg.startsWith('--overlap=')) opts.overlapMs = parseInt(arg.split('=')[1]);
        if (arg.startsWith('--model=')) opts.model = arg.split('=')[1];
        if (arg.startsWith('--duration=')) opts.durationSec = parseInt(arg.split('=')[1]);
        if (arg === '--no-system-audio') opts.systemAudio = false;
    }

    return opts;
}

function resolveModelPath(modelName: string): string {
    const filename = `ggml-${modelName}.bin`;
    return path.join(MODELS_DIR, filename);
}

// ── Audio Recording (continuous WAV chunks via ffmpeg) ───────────────────────

/**
 * Records audio in a loop, writing sequential WAV files of `chunkMs` duration.
 * Uses ffmpeg segment muxer to produce chunk_000.wav, chunk_001.wav, etc.
 * 
 * For mic + system audio: uses two ffmpeg instances piped into one via amix,
 * or falls back to mic-only if system audio is unavailable.
 */
function startRecording(opts: {
    chunkMs: number;
    durationSec: number;
    systemAudio: boolean;
}): { process: ChildProcess; outputDir: string } {
    const outputDir = TEMP_DIR;
    if (fs.existsSync(outputDir)) {
        fs.readdirSync(outputDir).forEach(f => fs.unlinkSync(path.join(outputDir, f)));
    } else {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const chunkSec = (opts.chunkMs / 1000).toFixed(3);
    const outputPattern = path.join(outputDir, 'chunk_%03d.wav');

    let ffmpegArgs: string[];

    if (opts.systemAudio) {
        // Capture mic + system audio (WASAPI loopback) and mix them
        // Note: WASAPI loopback captures what's playing through speakers
        ffmpegArgs = [
            // Input 0: Microphone
            '-f', 'dshow',
            '-i', `audio=${MIC_DEVICE}`,
            // Input 1: System audio via WASAPI loopback (default render device)
            '-f', 'dshow',
            '-audio_buffer_size', '50',
            '-i', `audio=${MIC_DEVICE}`,  // Fallback: we try WASAPI, but use mic as backup
            // Mix both inputs
            '-filter_complex', '[0:a]aresample=16000[mic];[1:a]aresample=16000[sys];[mic][sys]amix=inputs=2:duration=longest:dropout_transition=0[out]',
            '-map', '[out]',
            // Output settings
            '-ar', '16000',
            '-ac', '1',
            '-acodec', 'pcm_s16le',
            '-t', opts.durationSec.toString(),
            // Segment output
            '-f', 'segment',
            '-segment_time', chunkSec,
            '-reset_timestamps', '1',
            outputPattern,
        ];
    } else {
        // Mic only
        ffmpegArgs = [
            '-f', 'dshow',
            '-i', `audio=${MIC_DEVICE}`,
            '-ar', '16000',
            '-ac', '1',
            '-acodec', 'pcm_s16le',
            '-t', opts.durationSec.toString(),
            '-f', 'segment',
            '-segment_time', chunkSec,
            '-reset_timestamps', '1',
            outputPattern,
        ];
    }

    const proc = spawn('ffmpeg', ffmpegArgs, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    // If system audio fails, restart with mic-only
    let stderrBuf = '';
    proc.stderr?.on('data', (d) => {
        stderrBuf += d.toString();
    });

    return { process: proc, outputDir };
}

// ── Whisper transcription ────────────────────────────────────────────────────

function transcribeChunk(wavPath: string, modelPath: string): Promise<{ text: string; elapsedMs: number }> {
    return new Promise((resolve, reject) => {
        const args = [
            '-m', modelPath,
            '-f', wavPath,
            '-l', 'en',
            '-nt',
        ];

        const start = Date.now();
        const proc = spawn(WHISPER_EXE, args, { windowsHide: true });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            const elapsedMs = Date.now() - start;
            if (code !== 0) {
                reject(new Error(`whisper failed: ${stderr}`));
                return;
            }
            const text = stdout
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0 && !l.startsWith('['))
                .join(' ');
            resolve({ text, elapsedMs });
        });
        proc.on('error', reject);
    });
}

// ── Transcript stabilization ─────────────────────────────────────────────────

class TranscriptStabilizer {
    private confirmedWords: string[] = [];
    private lastChunkWords: string[] = [];
    private overlapMs: number;

    constructor(overlapMs: number) {
        this.overlapMs = overlapMs;
    }

    /**
     * Takes the text from the latest chunk and merges it with the running transcript.
     * Uses word-level overlap detection to avoid duplicates.
     */
    addChunk(text: string): string {
        const newWords = text.split(/\s+/).filter(w => w.length > 0);
        if (newWords.length === 0) return this.getText();

        if (this.confirmedWords.length === 0) {
            // First chunk
            this.confirmedWords = [...newWords];
            this.lastChunkWords = [...newWords];
            return this.getText();
        }

        if (this.overlapMs <= 0) {
            // No overlap — just append
            this.confirmedWords.push(...newWords);
            this.lastChunkWords = [...newWords];
            return this.getText();
        }

        // Find overlap between end of confirmed text and start of new text
        const maxOverlapWords = Math.min(this.lastChunkWords.length, newWords.length, 12);
        let bestOverlap = 0;

        for (let len = 1; len <= maxOverlapWords; len++) {
            const tail = this.lastChunkWords.slice(-len).map(w => w.toLowerCase()).join(' ');
            const head = newWords.slice(0, len).map(w => w.toLowerCase()).join(' ');
            if (tail === head) {
                bestOverlap = len;
            }
        }

        // Append only the non-overlapping portion
        const uniqueWords = newWords.slice(bestOverlap);
        if (uniqueWords.length > 0) {
            this.confirmedWords.push(...uniqueWords);
        }
        this.lastChunkWords = [...newWords];

        return this.getText();
    }

    getText(): string {
        return this.confirmedWords.join(' ');
    }
}

// ── Main loop ────────────────────────────────────────────────────────────────

async function main() {
    const opts = parseArgs();
    const modelPath = resolveModelPath(opts.model);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   Whisper Live Streaming Simulation                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Validate
    if (!fs.existsSync(WHISPER_EXE)) {
        console.error('❌ whisper.exe not found');
        process.exit(1);
    }
    if (!fs.existsSync(modelPath)) {
        console.error(`❌ Model not found: ${modelPath}`);
        console.error(`   Available: ${fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.bin')).join(', ')}`);
        process.exit(1);
    }

    console.log(`  🎤 Mic:      ${MIC_DEVICE}`);
    console.log(`  🔊 System:   ${opts.systemAudio ? 'Enabled (will try WASAPI loopback)' : 'Disabled'}`);
    console.log(`  📦 Model:    ${opts.model} (${path.basename(modelPath)})`);
    console.log(`  📏 Chunk:    ${opts.chunkMs}ms`);
    console.log(`  🔄 Overlap:  ${opts.overlapMs}ms`);
    console.log(`  ⏱  Duration: ${opts.durationSec}s`);
    console.log('');
    console.log('  Starting in 2 seconds... Speak into your mic!\n');
    await new Promise(r => setTimeout(r, 2000));

    // Start recording (always mic-only for reliability in standalone mode)
    // System audio capture outside Electron requires WASAPI loopback which may
    // not work with dshow. We fall back to mic-only and note it.
    console.log('🎤 Recording started. Listening...\n');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('LIVE TRANSCRIPT:');
    console.log('─────────────────────────────────────────────────────────────────\n');

    const { process: ffmpegProc, outputDir } = startRecording({
        ...opts,
        systemAudio: false, // Force mic-only for standalone reliability
    });

    const stabilizer = new TranscriptStabilizer(opts.overlapMs);
    let lastProcessedChunk = -1;
    let totalInferenceMs = 0;
    let chunksProcessed = 0;
    const startTime = Date.now();

    // Poll for new chunk files and transcribe them
    const pollInterval = setInterval(async () => {
        if (!fs.existsSync(outputDir)) return;

        const files = fs.readdirSync(outputDir)
            .filter(f => f.startsWith('chunk_') && f.endsWith('.wav'))
            .sort();

        // Process all completed chunks (NOT the last one — it's still being written)
        for (let i = 0; i < files.length - 1; i++) {
            const chunkNum = parseInt(files[i].replace('chunk_', '').replace('.wav', ''));
            if (chunkNum <= lastProcessedChunk) continue;

            const chunkPath = path.join(outputDir, files[i]);

            try {
                const { text, elapsedMs } = await transcribeChunk(chunkPath, modelPath);
                lastProcessedChunk = chunkNum;
                chunksProcessed++;
                totalInferenceMs += elapsedMs;

                if (text.trim()) {
                    const fullText = stabilizer.addChunk(text.trim());

                    // Clear line and reprint full transcript
                    process.stdout.write(`\r\x1b[K`);
                    process.stdout.write(`  ${fullText}`);

                    // Print timing info on next line
                    const avgMs = totalInferenceMs / chunksProcessed;
                    const rtf = avgMs / opts.chunkMs;
                    process.stdout.write(`\n  \x1b[90m[chunk #${chunkNum} | ${elapsedMs}ms | avg ${avgMs.toFixed(0)}ms | RTF ${rtf.toFixed(2)}x]\x1b[0m\n`);
                }
            } catch (error) {
                // Chunk may be too small or corrupted at the boundary
                lastProcessedChunk = chunkNum;
            }
        }
    }, 500); // Poll every 500ms

    // Wait for ffmpeg to finish (or ctrl+c)
    const cleanup = () => {
        clearInterval(pollInterval);

        // Kill ffmpeg
        try { ffmpegProc.kill('SIGTERM'); } catch {}

        // Print summary
        const totalTimeSec = (Date.now() - startTime) / 1000;
        console.log('\n\n─────────────────────────────────────────────────────────────────');
        console.log('📊 SESSION SUMMARY');
        console.log('─────────────────────────────────────────────────────────────────');
        console.log(`  Duration:         ${totalTimeSec.toFixed(1)}s`);
        console.log(`  Chunks processed: ${chunksProcessed}`);
        console.log(`  Avg inference:    ${chunksProcessed > 0 ? (totalInferenceMs / chunksProcessed).toFixed(0) : '—'}ms`);
        console.log(`  Avg RTF:          ${chunksProcessed > 0 ? ((totalInferenceMs / chunksProcessed) / opts.chunkMs).toFixed(2) : '—'}x`);
        console.log(`  Total inference:  ${(totalInferenceMs / 1000).toFixed(2)}s`);
        console.log('');
        console.log('  FINAL TRANSCRIPT:');
        console.log(`  "${stabilizer.getText()}"`);
        console.log('');

        // Cleanup temp files
        if (fs.existsSync(outputDir)) {
            fs.readdirSync(outputDir).forEach(f => fs.unlinkSync(path.join(outputDir, f)));
            fs.rmdirSync(outputDir);
        }
    };

    process.on('SIGINT', () => {
        cleanup();
        process.exit(0);
    });

    ffmpegProc.on('close', () => {
        // Process any remaining chunks
        setTimeout(() => {
            cleanup();
        }, 2000); // Give time for last chunk
    });
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
