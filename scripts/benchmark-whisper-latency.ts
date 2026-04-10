import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseAudioPath(): string {
    const argPath = process.argv[2];
    if (argPath) return argPath;

    const testDataDir = path.join(__dirname, '..', 'test-data');
    const audioExtensions = new Set(['.wav', '.mp3', '.flac', '.ogg']);
    const files = fs.existsSync(testDataDir) ? fs.readdirSync(testDataDir) : [];
    const found = files.find((f) => audioExtensions.has(path.extname(f).toLowerCase()));

    if (!found) {
        throw new Error('No audio file found. Put one under test-data/ or pass path as arg.');
    }
    return path.join(testDataDir, found);
}

type RunResult = {
    durationMs: number;
    elapsedMs: number;
    text: string;
};

function runWhisperWindow(audioPath: string, durationMs: number): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const whisperExe = path.join(__dirname, '..', 'native', 'whisper', 'whisper.exe');
        const modelPath = path.join(__dirname, '..', 'native', 'whisper', 'models', 'ggml-base.en.bin');

        const args = [
            '-m', modelPath,
            '-f', audioPath,
            '-ot', '0',
            '-d', durationMs.toString(),
            '-l', 'en',
            '-nt',
            '-np',
            '-ng',
            '-nfa',
        ];

        const startedAt = Date.now();
        const proc = spawn(whisperExe, args, { windowsHide: true });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => {
            stdout += d.toString();
        });
        proc.stderr.on('data', (d) => {
            stderr += d.toString();
        });
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
            const elapsedMs = Date.now() - startedAt;
            if (code !== 0) {
                reject(new Error(`whisper exited ${code}: ${stderr || stdout}`));
                return;
            }
            const text = stdout
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0 && !line.startsWith('['))
                .join(' ');
            resolve({ durationMs, elapsedMs, text });
        });
    });
}

async function main() {
    const audioPath = parseAudioPath();
    const windows = [1000, 2000, 4000, 8000];

    console.log('\nWhisper Latency Benchmark (CPU, app-like flags)');
    console.log('================================================');
    console.log(`Audio: ${audioPath}`);
    console.log('Flags: -nt -np -ng -nfa');
    console.log('');

    for (const durationMs of windows) {
        const result = await runWhisperWindow(audioPath, durationMs);
        const rtf = result.elapsedMs / result.durationMs;
        console.log(
            `${(durationMs / 1000).toFixed(1)}s window -> ${(result.elapsedMs / 1000).toFixed(2)}s wall time ` +
            `(RTF ${rtf.toFixed(2)}x), text="${result.text.slice(0, 80)}${result.text.length > 80 ? '...' : ''}"`
        );
    }

    console.log('\nInterpretation:');
    console.log('- RTF < 1.0x: faster than real-time (good for near-instant previews).');
    console.log('- RTF > 1.0x: slower than real-time (preview will lag).');
}

main().catch((err) => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});

