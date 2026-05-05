/**
 * Script 2: Whisper Pipeline Benchmark — Accuracy & Speed Matrix
 * 
 * Records ~15s of you speaking, then tests whisper.exe with multiple
 * configurations (chunk sizes, overlap, models) and displays a comparison
 * table so you can see what works best.
 * 
 * Run with:  bun run scripts/benchmark-whisper-pipeline.ts
 * 
 * Or with existing audio:
 *   bun run scripts/benchmark-whisper-pipeline.ts path/to/audio.wav
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const WHISPER_EXE = path.join(ROOT, 'native', 'whisper', 'whisper.exe');
const MODELS_DIR = path.join(ROOT, 'native', 'whisper', 'models');
const TEST_DATA = path.join(ROOT, 'test-data');
const RECORDING_WAV = path.join(TEST_DATA, 'benchmark-recording.wav');
const MIC_DEVICE = 'Microphone Array (Realtek(R) Audio)';

const RECORD_DURATION = 15; // seconds

// Known reference text (printed for the user to read aloud)
const REFERENCE_TEXT = `The quick brown fox jumps over the lazy dog. 
Artificial intelligence is transforming how we build software today. 
Can you explain the difference between machine learning and deep learning?`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function recordAudio(outputPath: string, durationSec: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-f', 'dshow',
            '-i', `audio=${MIC_DEVICE}`,
            '-t', durationSec.toString(),
            '-ar', '16000',
            '-ac', '1',
            '-acodec', 'pcm_s16le',
            outputPath,
        ];

        const proc = spawn('ffmpeg', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) reject(new Error(`ffmpeg failed: ${stderr}`));
            else resolve();
        });
        proc.on('error', reject);
    });
}

function getAudioDurationMs(wavPath: string): number {
    // Read WAV header to get duration
    const buf = fs.readFileSync(wavPath);
    // PCM 16-bit mono 16kHz: data size = fileSize - 44 header
    const dataSize = buf.length - 44;
    const bytesPerSample = 2; // 16-bit
    const sampleRate = 16000;
    const totalSamples = dataSize / bytesPerSample;
    return (totalSamples / sampleRate) * 1000;
}

function splitWavIntoChunks(wavPath: string, chunkMs: number, overlapMs: number): string[] {
    const buf = fs.readFileSync(wavPath);
    const headerSize = 44;
    const header = buf.subarray(0, headerSize);
    const rawData = buf.subarray(headerSize);

    const bytesPerSample = 2;
    const sampleRate = 16000;
    const chunkSamples = Math.floor((sampleRate * chunkMs) / 1000);
    const overlapSamples = Math.floor((sampleRate * overlapMs) / 1000);
    const stepSamples = chunkSamples - overlapSamples;
    const chunkBytes = chunkSamples * bytesPerSample;
    const stepBytes = stepSamples * bytesPerSample;

    const totalSamples = rawData.length / bytesPerSample;
    const chunks: string[] = [];
    const chunksDir = path.join(TEST_DATA, 'chunks');
    if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

    let offset = 0;
    let i = 0;
    while (offset < rawData.length) {
        const endOffset = Math.min(offset + chunkBytes, rawData.length);
        const chunkData = rawData.subarray(offset, endOffset);
        const actualSamples = chunkData.length / bytesPerSample;

        // Build WAV with updated header
        const wavBuf = Buffer.alloc(headerSize + chunkData.length);
        // Copy and patch header
        header.copy(wavBuf, 0);
        // File size - 8
        wavBuf.writeUInt32LE(wavBuf.length - 8, 4);
        // Data chunk size
        wavBuf.writeUInt32LE(chunkData.length, 40);
        chunkData.copy(wavBuf, headerSize);

        const chunkPath = path.join(chunksDir, `chunk_${String(i).padStart(3, '0')}.wav`);
        fs.writeFileSync(chunkPath, wavBuf);
        chunks.push(chunkPath);

        offset += stepBytes;
        i++;
    }

    return chunks;
}

interface WhisperResult {
    text: string;
    elapsedMs: number;
}

function runWhisper(wavPath: string, modelPath: string, useGpu: boolean = true): Promise<WhisperResult> {
    return new Promise((resolve, reject) => {
        const args = [
            '-m', modelPath,
            '-f', wavPath,
            '-l', 'en',
            '-nt',
        ];
        if (!useGpu) args.push('-ng');

        const start = Date.now();
        const proc = spawn(WHISPER_EXE, args, { windowsHide: true });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            const elapsedMs = Date.now() - start;
            if (code !== 0) {
                reject(new Error(`whisper failed (code ${code}): ${stderr}`));
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

interface BenchmarkConfig {
    name: string;
    chunkMs: number;         // 0 = full file
    overlapMs: number;
    model: string;           // filename in models dir
    modelLabel: string;
}

interface BenchmarkResult {
    config: BenchmarkConfig;
    totalMs: number;
    avgChunkMs: number;
    rtf: number;             // real-time factor
    text: string;
    chunksProcessed: number;
}

async function runBenchmark(wavPath: string, config: BenchmarkConfig): Promise<BenchmarkResult> {
    const modelPath = path.join(MODELS_DIR, config.model);

    if (!fs.existsSync(modelPath)) {
        return {
            config,
            totalMs: -1,
            avgChunkMs: -1,
            rtf: -1,
            text: `⚠️  Model not found: ${config.model}`,
            chunksProcessed: 0,
        };
    }

    const audioDurationMs = getAudioDurationMs(wavPath);

    if (config.chunkMs === 0) {
        // Full-file baseline
        const result = await runWhisper(wavPath, modelPath);
        return {
            config,
            totalMs: result.elapsedMs,
            avgChunkMs: result.elapsedMs,
            rtf: result.elapsedMs / audioDurationMs,
            text: result.text,
            chunksProcessed: 1,
        };
    }

    // Chunked mode
    const chunks = splitWavIntoChunks(wavPath, config.chunkMs, config.overlapMs);
    let totalMs = 0;
    const texts: string[] = [];

    for (const chunkPath of chunks) {
        const result = await runWhisper(chunkPath, modelPath);
        totalMs += result.elapsedMs;
        if (result.text.trim()) texts.push(result.text.trim());
    }

    // Simple deduplication for overlapping chunks:
    // If overlap is used, remove duplicate words at chunk boundaries
    let finalText: string;
    if (config.overlapMs > 0 && texts.length > 1) {
        finalText = deduplicateOverlappingText(texts);
    } else {
        finalText = texts.join(' ');
    }

    // Cleanup chunk files
    const chunksDir = path.join(TEST_DATA, 'chunks');
    if (fs.existsSync(chunksDir)) {
        fs.readdirSync(chunksDir).forEach(f => fs.unlinkSync(path.join(chunksDir, f)));
        fs.rmdirSync(chunksDir);
    }

    return {
        config,
        totalMs,
        avgChunkMs: totalMs / chunks.length,
        rtf: totalMs / audioDurationMs,
        text: finalText,
        chunksProcessed: chunks.length,
    };
}

function deduplicateOverlappingText(texts: string[]): string {
    if (texts.length === 0) return '';
    let result = texts[0];

    for (let i = 1; i < texts.length; i++) {
        const prevWords = result.split(/\s+/);
        const currWords = texts[i].split(/\s+/);

        // Find the longest overlap at the boundary
        let bestOverlap = 0;
        const maxCheck = Math.min(prevWords.length, currWords.length, 10);
        for (let overlapLen = 1; overlapLen <= maxCheck; overlapLen++) {
            const tail = prevWords.slice(-overlapLen).join(' ').toLowerCase();
            const head = currWords.slice(0, overlapLen).join(' ').toLowerCase();
            if (tail === head) {
                bestOverlap = overlapLen;
            }
        }

        // Append only the non-overlapping part
        const newPart = currWords.slice(bestOverlap).join(' ');
        if (newPart) {
            result += ' ' + newPart;
        }
    }

    return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   Whisper Pipeline Benchmark — Accuracy & Speed Matrix      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Check whisper.exe
    if (!fs.existsSync(WHISPER_EXE)) {
        console.error(`❌ whisper.exe not found. Run test-whisper-gpu.ts first.`);
        process.exit(1);
    }

    // Use provided audio or record fresh
    let wavPath = process.argv[2];
    if (wavPath && !fs.existsSync(wavPath)) {
        console.error(`❌ File not found: ${wavPath}`);
        process.exit(1);
    }

    if (!wavPath) {
        console.log('📖 Please read the following text aloud when recording starts:\n');
        console.log('   ┌─────────────────────────────────────────────────────────┐');
        REFERENCE_TEXT.split('\n').forEach(line => {
            console.log(`   │  ${line.trim().padEnd(55)} │`);
        });
        console.log('   └─────────────────────────────────────────────────────────┘\n');
        console.log(`Recording starts in 3 seconds...`);
        await new Promise(r => setTimeout(r, 3000));

        console.log(`\n🎤 Recording ${RECORD_DURATION}s — speak now!\n`);
        await recordAudio(RECORDING_WAV, RECORD_DURATION);
        wavPath = RECORDING_WAV;
        console.log('✅ Recording saved.\n');
    }

    const audioDurationMs = getAudioDurationMs(wavPath);
    console.log(`📁 Audio: ${path.basename(wavPath)} (${(audioDurationMs / 1000).toFixed(1)}s)\n`);

    // List available models
    const availableModels = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.bin'));
    console.log(`📦 Available models: ${availableModels.join(', ')}\n`);

    // Define benchmark configurations
    const configs: BenchmarkConfig[] = [
        // Full-file baselines
        { name: 'Full file (base.en)',      chunkMs: 0,    overlapMs: 0,    model: 'ggml-base.en.bin', modelLabel: 'base.en' },
        { name: 'Full file (small.en)',     chunkMs: 0,    overlapMs: 0,    model: 'ggml-small.en.bin', modelLabel: 'small.en' },

        // Chunked: 3s
        { name: '3s chunks, no overlap',    chunkMs: 3000, overlapMs: 0,    model: 'ggml-base.en.bin', modelLabel: 'base.en' },
        { name: '3s chunks, 1s overlap',    chunkMs: 3000, overlapMs: 1000, model: 'ggml-base.en.bin', modelLabel: 'base.en' },

        // Chunked: 5s
        { name: '5s chunks, no overlap',    chunkMs: 5000, overlapMs: 0,    model: 'ggml-base.en.bin', modelLabel: 'base.en' },
        { name: '5s chunks, 1.5s overlap',  chunkMs: 5000, overlapMs: 1500, model: 'ggml-base.en.bin', modelLabel: 'base.en' },

        // Best chunk with small.en
        { name: '3s chunks, 1s overlap',    chunkMs: 3000, overlapMs: 1000, model: 'ggml-small.en.bin', modelLabel: 'small.en' },
        { name: '5s chunks, 1.5s overlap',  chunkMs: 5000, overlapMs: 1500, model: 'ggml-small.en.bin', modelLabel: 'small.en' },
    ];

    // Run benchmarks
    const results: BenchmarkResult[] = [];
    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        const label = `[${i + 1}/${configs.length}] ${config.name} (${config.modelLabel})`;
        process.stdout.write(`⏱  ${label}...`);

        try {
            const result = await runBenchmark(wavPath, config);
            results.push(result);

            if (result.totalMs < 0) {
                console.log(' SKIPPED (model not found)');
            } else {
                console.log(` ${(result.totalMs / 1000).toFixed(2)}s (RTF ${result.rtf.toFixed(2)}x)`);
            }
        } catch (error) {
            console.log(` FAILED: ${error}`);
        }
    }

    // ── Results Table ────────────────────────────────────────────────────────
    console.log('\n');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('📊 RESULTS');
    console.log('══════════════════════════════════════════════════════════════════\n');

    // Print reference text
    console.log('📖 Reference text (what you should have read):');
    console.log(`   "${REFERENCE_TEXT.replace(/\n/g, ' ').trim()}"\n`);

    // Table header
    const colW = { name: 35, model: 10, time: 10, rtf: 8, chunks: 8 };
    console.log(
        '  ' +
        'Config'.padEnd(colW.name) +
        'Model'.padEnd(colW.model) +
        'Time'.padEnd(colW.time) +
        'RTF'.padEnd(colW.rtf) +
        'Chunks'.padEnd(colW.chunks)
    );
    console.log('  ' + '─'.repeat(colW.name + colW.model + colW.time + colW.rtf + colW.chunks));

    for (const r of results) {
        if (r.totalMs < 0) {
            console.log(
                '  ' +
                r.config.name.padEnd(colW.name) +
                r.config.modelLabel.padEnd(colW.model) +
                '—'.padEnd(colW.time) +
                '—'.padEnd(colW.rtf) +
                '—'.padEnd(colW.chunks)
            );
        } else {
            const rtfColor = r.rtf < 1 ? '🟢' : r.rtf < 2 ? '🟡' : '🔴';
            console.log(
                '  ' +
                r.config.name.padEnd(colW.name) +
                r.config.modelLabel.padEnd(colW.model) +
                `${(r.totalMs / 1000).toFixed(2)}s`.padEnd(colW.time) +
                `${rtfColor} ${r.rtf.toFixed(2)}x`.padEnd(colW.rtf + 2) +
                `${r.chunksProcessed}`.padEnd(colW.chunks)
            );
        }
    }

    // Transcription outputs
    console.log('\n\n📝 TRANSCRIPTION OUTPUTS\n');
    for (const r of results) {
        if (r.totalMs < 0) continue;
        console.log(`  ── ${r.config.name} (${r.config.modelLabel}) ──`);
        console.log(`  "${r.text}"\n`);
    }

    // Interpretation
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('📖 INTERPRETATION');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('  🟢 RTF < 1.0x = Faster than real-time (ideal for streaming)');
    console.log('  🟡 RTF 1-2x   = Usable but will have some lag');
    console.log('  🔴 RTF > 2x   = Too slow for real-time use');
    console.log('  → Compare transcription text to reference for accuracy');
    console.log('  → Overlap configs should have fewer missing words at boundaries\n');

    // Cleanup
    const chunksDir = path.join(TEST_DATA, 'chunks');
    if (fs.existsSync(chunksDir)) {
        fs.readdirSync(chunksDir).forEach(f => fs.unlinkSync(path.join(chunksDir, f)));
        fs.rmdirSync(chunksDir);
    }
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
