/**
 * Script 1: Whisper GPU Sanity Check
 * 
 * Verifies that whisper.exe works on this machine and checks GPU/CUDA status.
 * Records a short 5-second clip from the mic and transcribes it.
 * 
 * Run with:  bun run scripts/test-whisper-gpu.ts
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const WHISPER_EXE = path.join(ROOT, 'native', 'whisper', 'whisper.exe');
const MODEL_PATH = path.join(ROOT, 'native', 'whisper', 'models', 'ggml-base.en.bin');
const TEST_WAV = path.join(ROOT, 'test-data', 'gpu-test.wav');
const MIC_DEVICE = 'Microphone Array (Realtek(R) Audio)';

// ── Helpers ──────────────────────────────────────────────────────────────────

function checkPrerequisites() {
    console.log('🔍 Checking prerequisites...\n');

    if (!fs.existsSync(WHISPER_EXE)) {
        console.error(`❌ whisper.exe not found at: ${WHISPER_EXE}`);
        process.exit(1);
    }
    console.log(`  ✅ whisper.exe found`);

    if (!fs.existsSync(MODEL_PATH)) {
        console.error(`❌ Model not found at: ${MODEL_PATH}`);
        process.exit(1);
    }
    const modelSizeMB = (fs.statSync(MODEL_PATH).size / 1024 / 1024).toFixed(1);
    console.log(`  ✅ ggml-base.en.bin found (${modelSizeMB} MB)`);

    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        console.log(`  ✅ ffmpeg found`);
    } catch {
        console.error('❌ ffmpeg not found. Install it first.');
        process.exit(1);
    }

    console.log('');
}

function recordAudio(outputPath: string, durationSec: number): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`🎤 Recording ${durationSec}s from mic... (speak now!)\n`);

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
            if (code !== 0) {
                reject(new Error(`ffmpeg recording failed (code ${code}): ${stderr}`));
            } else {
                const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
                console.log(`  ✅ Recorded ${(size / 1024).toFixed(1)} KB\n`);
                resolve();
            }
        });
        proc.on('error', reject);
    });
}

interface WhisperResult {
    text: string;
    elapsedMs: number;
    stderr: string;
    gpuDetected: boolean;
    cudaDeviceName: string;
}

function runWhisper(wavPath: string, useGpu: boolean): Promise<WhisperResult> {
    return new Promise((resolve, reject) => {
        const args = [
            '-m', MODEL_PATH,
            '-f', wavPath,
            '-l', 'en',
            '-nt',          // no timestamps
        ];
        if (!useGpu) args.push('-ng');

        const start = Date.now();
        const proc = spawn(WHISPER_EXE, args, { windowsHide: true });

        let stdout = '';
        let stderr = '';
        let gpuDetected = false;
        let cudaDeviceName = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => {
            const chunk = d.toString();
            stderr += chunk;
            if (/cuda|gpu|cublas/i.test(chunk)) gpuDetected = true;
            const deviceMatch = chunk.match(/Device\s*\d*:\s*(.+)/i);
            if (deviceMatch) cudaDeviceName = deviceMatch[1].trim();
        });

        proc.on('close', (code) => {
            const elapsedMs = Date.now() - start;
            if (code !== 0) {
                reject(new Error(`whisper.exe exited ${code}:\n${stderr}`));
                return;
            }
            const text = stdout
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0 && !l.startsWith('['))
                .join(' ');
            resolve({ text, elapsedMs, stderr, gpuDetected, cudaDeviceName });
        });
        proc.on('error', reject);
    });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   Whisper.cpp GPU Sanity Check           ║');
    console.log('╚══════════════════════════════════════════╝\n');

    checkPrerequisites();

    // Record short test clip
    await recordAudio(TEST_WAV, 10);

    // ── GPU Test ─────────────────────────────────────────────────────────────
    console.log('⚡ Running whisper.exe (GPU mode)...');
    try {
        const gpuResult = await runWhisper(TEST_WAV, true);
        console.log(`  ⏱  Time: ${(gpuResult.elapsedMs / 1000).toFixed(2)}s`);
        console.log(`  🖥  GPU detected in logs: ${gpuResult.gpuDetected ? '✅ YES' : '❌ NO'}`);
        if (gpuResult.cudaDeviceName) {
            console.log(`  🎮 CUDA Device: ${gpuResult.cudaDeviceName}`);
        }
        console.log(`  📝 Text: "${gpuResult.text}"`);
        console.log('');

        // ── CPU Test ─────────────────────────────────────────────────────────
        console.log('🐢 Running whisper.exe (CPU mode, -ng flag)...');
        const cpuResult = await runWhisper(TEST_WAV, false);
        console.log(`  ⏱  Time: ${(cpuResult.elapsedMs / 1000).toFixed(2)}s`);
        console.log(`  📝 Text: "${cpuResult.text}"`);
        console.log('');

        // ── Summary ──────────────────────────────────────────────────────────
        const speedup = cpuResult.elapsedMs / gpuResult.elapsedMs;
        console.log('═══════════════════════════════════════════');
        console.log('📊 SUMMARY');
        console.log('═══════════════════════════════════════════');
        console.log(`  GPU time:   ${(gpuResult.elapsedMs / 1000).toFixed(2)}s`);
        console.log(`  CPU time:   ${(cpuResult.elapsedMs / 1000).toFixed(2)}s`);
        console.log(`  Speedup:    ${speedup.toFixed(2)}x`);
        console.log(`  GPU works:  ${gpuResult.gpuDetected ? '✅ YES — CUDA is active' : '⚠️  NO — falling back to CPU'}`);
        console.log(`  Match:      ${gpuResult.text === cpuResult.text ? '✅ Identical output' : '⚠️  Outputs differ (normal for GPU vs CPU)'}`);
        console.log('');

        if (!gpuResult.gpuDetected) {
            console.log('💡 GPU not detected. Possible reasons:');
            console.log('   - Your whisper.exe build may not include CUDA support');
            console.log('   - CUDA toolkit may not be installed');
            console.log('   - NVIDIA drivers may need updating');
            console.log('   → CPU mode still works fine, just slower\n');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }

    // Cleanup
    if (fs.existsSync(TEST_WAV)) fs.unlinkSync(TEST_WAV);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
