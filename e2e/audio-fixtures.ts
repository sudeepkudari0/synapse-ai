/**
 * Audio Fixtures — WAV file loading and Float32Array conversion for E2E tests.
 *
 * Loads pre-generated TTS audio files from test-data/interview-audio/
 * and converts them to the Float32Array format expected by the transcription pipeline.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ─── WAV File Parser ─────────────────────────────────────────────────

export interface WavData {
    sampleRate: number;
    numChannels: number;
    bitsPerSample: number;
    samples: Float32Array;
    durationMs: number;
}

/**
 * Parse a WAV file buffer into its components.
 * Supports 16-bit and 32-bit PCM, mono and stereo (converts stereo to mono).
 */
export function parseWav(buffer: Buffer): WavData {
    // Verify RIFF header
    const riff = buffer.toString('ascii', 0, 4);
    if (riff !== 'RIFF') throw new Error(`Invalid WAV: expected RIFF, got "${riff}"`);

    const wave = buffer.toString('ascii', 8, 12);
    if (wave !== 'WAVE') throw new Error(`Invalid WAV: expected WAVE, got "${wave}"`);

    // Find fmt chunk
    let offset = 12;
    let sampleRate = 0;
    let numChannels = 0;
    let bitsPerSample = 0;
    let dataBuffer: Buffer | null = null;

    while (offset < buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);

        if (chunkId === 'fmt ') {
            const audioFormat = buffer.readUInt16LE(offset + 8);
            if (audioFormat !== 1 && audioFormat !== 3) {
                throw new Error(`Unsupported audio format: ${audioFormat} (only PCM=1 and Float=3 supported)`);
            }
            numChannels = buffer.readUInt16LE(offset + 10);
            sampleRate = buffer.readUInt32LE(offset + 12);
            bitsPerSample = buffer.readUInt16LE(offset + 22);
        } else if (chunkId === 'data') {
            dataBuffer = buffer.subarray(offset + 8, offset + 8 + chunkSize);
        }

        offset += 8 + chunkSize;
        // Pad to even boundary
        if (chunkSize % 2 !== 0) offset += 1;
    }

    if (!dataBuffer) throw new Error('No data chunk found in WAV');
    if (sampleRate === 0) throw new Error('No fmt chunk found in WAV');

    // Convert to Float32Array
    const bytesPerSample = bitsPerSample / 8;
    const numSamples = Math.floor(dataBuffer.length / (bytesPerSample * numChannels));
    const samples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        if (numChannels === 1) {
            samples[i] = readSample(dataBuffer, i * bytesPerSample, bitsPerSample);
        } else {
            // Mix stereo to mono
            let sum = 0;
            for (let ch = 0; ch < numChannels; ch++) {
                sum += readSample(dataBuffer, (i * numChannels + ch) * bytesPerSample, bitsPerSample);
            }
            samples[i] = sum / numChannels;
        }
    }

    return {
        sampleRate,
        numChannels,
        bitsPerSample,
        samples,
        durationMs: (numSamples / sampleRate) * 1000,
    };
}

function readSample(buffer: Buffer, offset: number, bits: number): number {
    if (bits === 16) {
        return buffer.readInt16LE(offset) / 32768;
    } else if (bits === 32) {
        return buffer.readFloatLE(offset);
    } else if (bits === 8) {
        return (buffer.readUInt8(offset) - 128) / 128;
    }
    throw new Error(`Unsupported bit depth: ${bits}`);
}

// ─── Resampler ───────────────────────────────────────────────────────

/**
 * Simple linear interpolation resampler to convert audio to 16kHz.
 */
export function resampleTo16kHz(samples: Float32Array, sourceSampleRate: number): Float32Array {
    if (sourceSampleRate === 16000) return samples;

    const ratio = sourceSampleRate / 16000;
    const outputLength = Math.floor(samples.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const srcIdx = i * ratio;
        const lower = Math.floor(srcIdx);
        const upper = Math.min(lower + 1, samples.length - 1);
        const frac = srcIdx - lower;
        output[i] = samples[lower] * (1 - frac) + samples[upper] * frac;
    }

    return output;
}

// ─── Audio Fixture Loader ────────────────────────────────────────────

export interface AudioFixture {
    id: string;
    text: string;
    category: 'interviewer' | 'user' | 'acknowledgments' | 'silence';
    filePath: string;
    samples: Float32Array;
    durationMs: number;
    sampleRate: number;
}

export interface ManifestEntry {
    id: string;
    text?: string;
    file: string;
    durationMs?: number;
}

export interface Manifest {
    generated: string;
    sampleRate: number;
    bitsPerSample: number;
    channels: number;
    interviewer: ManifestEntry[];
    user: ManifestEntry[];
    acknowledgments: ManifestEntry[];
    silence: ManifestEntry[];
}

const AUDIO_DIR = path.join(__dirname, '..', 'test-data', 'interview-audio');

/**
 * Load the audio manifest file.
 */
export function loadManifest(): Manifest {
    const manifestPath = path.join(AUDIO_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(
            `Audio manifest not found at ${manifestPath}.\n` +
            `Run: powershell -ExecutionPolicy Bypass -File scripts/generate-test-audio.ps1`
        );
    }
    let rawContent = fs.readFileSync(manifestPath, 'utf-8');
    if (rawContent.charCodeAt(0) === 0xFEFF) {
        rawContent = rawContent.slice(1);
    }
    return JSON.parse(rawContent);
}

/**
 * Load a single WAV file and return as 16kHz Float32Array.
 */
export function loadAudioFile(relativePath: string): AudioFixture {
    const absPath = path.join(AUDIO_DIR, relativePath);
    if (!fs.existsSync(absPath)) {
        throw new Error(`Audio file not found: ${absPath}`);
    }

    const buffer = fs.readFileSync(absPath);
    const wav = parseWav(buffer);
    const samples = resampleTo16kHz(wav.samples, wav.sampleRate);

    // Extract metadata from path
    const parts = relativePath.split('/');
    const category = parts[0] as AudioFixture['category'];
    const id = path.basename(relativePath, '.wav');

    return {
        id,
        text: '',
        category,
        filePath: absPath,
        samples,
        durationMs: (samples.length / 16000) * 1000,
        sampleRate: 16000,
    };
}

/**
 * Load all audio fixtures from the manifest.
 */
export function loadAllFixtures(): {
    interviewer: AudioFixture[];
    user: AudioFixture[];
    acknowledgments: AudioFixture[];
    silence: AudioFixture[];
} {
    const manifest = loadManifest();

    const loadCategory = (entries: ManifestEntry[], category: AudioFixture['category']): AudioFixture[] => {
        return entries.map(entry => {
            const fixture = loadAudioFile(entry.file);
            fixture.text = entry.text || '';
            fixture.category = category;
            return fixture;
        });
    };

    return {
        interviewer: loadCategory(manifest.interviewer, 'interviewer'),
        user: loadCategory(manifest.user, 'user'),
        acknowledgments: loadCategory(manifest.acknowledgments, 'acknowledgments'),
        silence: loadCategory(manifest.silence, 'silence'),
    };
}

/**
 * Check if audio fixtures exist. Returns false if they need to be generated.
 */
export function fixturesExist(): boolean {
    const manifestPath = path.join(AUDIO_DIR, 'manifest.json');
    return fs.existsSync(manifestPath);
}

// ─── Synthetic Audio Generators ──────────────────────────────────────
// For tests that don't need real speech (e.g., energy filter, silence detection)

/**
 * Generate silent audio (all zeros).
 */
export function generateSilence(durationMs: number): Float32Array {
    const numSamples = Math.floor(16000 * durationMs / 1000);
    return new Float32Array(numSamples);
}

/**
 * Generate a sine wave tone (useful for testing energy detection).
 */
export function generateTone(
    durationMs: number,
    frequency: number = 440,
    amplitude: number = 0.5
): Float32Array {
    const numSamples = Math.floor(16000 * durationMs / 1000);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / 16000);
    }
    return samples;
}

/**
 * Generate white noise.
 */
export function generateNoise(durationMs: number, amplitude: number = 0.1): Float32Array {
    const numSamples = Math.floor(16000 * durationMs / 1000);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        samples[i] = (Math.random() * 2 - 1) * amplitude;
    }
    return samples;
}
