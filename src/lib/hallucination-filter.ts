/**
 * HallucinationFilter — Multi-layer post-processing filter for Whisper output.
 *
 * Whisper is trained on YouTube data and frequently hallucinates phrases like
 * "Thank you for watching" during silence or low-energy audio. This filter
 * catches these artifacts before they reach the transcript.
 *
 * Layers:
 *   1. Blocklist — known hallucinated phrases
 *   2. Compression ratio — repetitive text has high compression ratio
 *   3. Repetition loop — same phrase repeated multiple times
 *   4. Energy-based pre-filter — reject audio with insufficient energy
 */

export interface FilterResult {
    valid: boolean;
    reason?: string;
    filteredText?: string;
}

/**
 * Known hallucinated phrases that Whisper produces on silence/noise.
 * These are learned from YouTube subtitles in training data.
 */
const HALLUCINATION_BLOCKLIST = [
    'thank you for watching',
    'thanks for watching',
    'please subscribe',
    'like and subscribe',
    'see you next time',
    'see you in the next',
    'subtitles by',
    'translated by',
    'transcribed by',
    'captions by',
    'thank you so much for watching',
    'don\'t forget to subscribe',
    'hit the bell',
    'click the link',
    'in the description',
    'leave a comment',
    'share this video',
    'bye bye',
    'music playing',
    'applause',
    'laughter',
    '♪',
    '♫',
    '[music]',
    '[applause]',
    '[laughter]',
];

const EXACT_MATCH_BLOCKLIST = [
    'you',
    'you.',
    'you?',
    'music',
    'music.',
];

/**
 * Calculate a simple compression ratio for text.
 * Repetitive/hallucinated text compresses much more than real speech.
 * We use a character frequency approach since we can't use zlib in browser.
 */
function getCompressionRatio(text: string): number {
    if (text.length === 0) return 0;

    // Count character bigrams
    const bigrams = new Map<string, number>();
    for (let i = 0; i < text.length - 1; i++) {
        const bigram = text.substring(i, i + 2);
        bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }

    // If any bigram appears disproportionately often, the text is repetitive
    const totalBigrams = text.length - 1;
    const uniqueBigrams = bigrams.size;

    if (uniqueBigrams === 0) return 999;
    return totalBigrams / uniqueBigrams;
}

/**
 * Detect repetition loops: "word word word" or "phrase phrase phrase".
 * Checks if any word or short phrase repeats more than 3 times consecutively.
 */
function hasRepetitionLoop(text: string): boolean {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length < 4) return false;

    // Check single-word repetition (e.g., "the the the the")
    let consecutiveCount = 1;
    for (let i = 1; i < words.length; i++) {
        if (words[i] === words[i - 1]) {
            consecutiveCount++;
            if (consecutiveCount >= 3) return true;
        } else {
            consecutiveCount = 1;
        }
    }

    // Check 2-word phrase repetition (e.g., "thank you thank you thank you")
    for (let phraseLen = 2; phraseLen <= 4; phraseLen++) {
        if (words.length < phraseLen * 3) continue;

        for (let start = 0; start <= words.length - phraseLen * 3; start++) {
            const phrase = words.slice(start, start + phraseLen).join(' ');
            let repeats = 1;
            let pos = start + phraseLen;

            while (pos + phraseLen <= words.length) {
                const next = words.slice(pos, pos + phraseLen).join(' ');
                if (next === phrase) {
                    repeats++;
                    pos += phraseLen;
                } else {
                    break;
                }
            }

            if (repeats >= 3) return true;
        }
    }

    return false;
}

/**
 * Check if audio has sufficient energy to contain real speech.
 * Very low RMS means the audio is silence/noise — skip sending to Whisper.
 *
 * @param audio - Float32Array PCM samples
 * @param threshold - RMS threshold (default 0.008, tuned for 16kHz mic input)
 * @returns true if audio has meaningful energy
 */
export function hasSignificantEnergy(audio: Float32Array, threshold = 0.008): boolean {
    if (audio.length === 0) return false;

    let sumSquares = 0;
    // Sample every 4th value for performance on large arrays
    const step = Math.max(1, Math.floor(audio.length / 4000));
    let count = 0;

    for (let i = 0; i < audio.length; i += step) {
        sumSquares += audio[i] * audio[i];
        count++;
    }

    const rms = Math.sqrt(sumSquares / count);
    return rms > threshold;
}

/**
 * Filter Whisper transcription output for hallucinations.
 *
 * @param text - The transcribed text from Whisper
 * @returns FilterResult indicating if text is valid or should be discarded
 */
export function filterHallucinations(text: string): FilterResult {
    if (!text || text.trim().length === 0) {
        return { valid: false, reason: 'empty' };
    }

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // Layer 1: Blocklist check
    for (const phrase of HALLUCINATION_BLOCKLIST) {
        if (lower === phrase || lower.includes(phrase)) {
            return { valid: false, reason: `blocklist: "${phrase}"` };
        }
    }

    for (const phrase of EXACT_MATCH_BLOCKLIST) {
        if (lower === phrase) {
            return { valid: false, reason: `exact_blocklist: "${phrase}"` };
        }
    }

    // Layer 2: Very short single-character or single-word output is suspicious
    const words = trimmed.split(/\s+/);
    if (words.length === 1 && trimmed.length <= 3 && !['yes', 'no', 'ok', 'hi'].includes(lower.replace(/[^a-z]/g, ''))) {
        return { valid: false, reason: 'too_short' };
    }

    // Layer 3: Compression ratio check (repetitive text)
    const ratio = getCompressionRatio(lower);
    if (ratio > 4.5 && trimmed.length > 30) {
        return { valid: false, reason: `high_compression_ratio: ${ratio.toFixed(2)}` };
    }

    // Layer 4: Repetition loop detection
    if (hasRepetitionLoop(trimmed)) {
        return { valid: false, reason: 'repetition_loop' };
    }

    // Layer 5: Text that is only punctuation or special characters
    const alphanumeric = trimmed.replace(/[^a-zA-Z0-9]/g, '');
    if (alphanumeric.length === 0) {
        return { valid: false, reason: 'no_alphanumeric' };
    }

    return { valid: true, filteredText: trimmed };
}
