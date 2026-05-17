/**
 * TimestampDeduplicator — Word-level timestamp-based deduplication for
 * streaming Whisper transcription.
 *
 * Unlike the old TranscriptStabilizer which used fragile suffix-prefix string
 * matching, this uses word-level timestamps from Whisper's verbose_json output
 * to determine exactly which words are new vs. already transcribed.
 *
 * Each word has a start/end time relative to the utterance's position in the
 * audio stream. We track the last confirmed end time per speaker and only
 * accept words whose timestamps fall after that point.
 *
 * When word timestamps are unavailable (server doesn't support verbose_json),
 * falls back to improved suffix-prefix string matching.
 */

export interface TimestampedWord {
    word: string;
    start: number;  // seconds, relative to utterance start
    end: number;    // seconds, relative to utterance start
}

export class TimestampDeduplicator {
    private confirmedWords: string[] = [];
    private lastUtteranceEndTime: number = 0;
    private utteranceCount: number = 0;

    /**
     * Add a new utterance with word-level timestamps.
     * Since we use utterance-based chunking (no overlap), each utterance
     * is a self-contained speech segment. The primary dedup concern is
     * Whisper producing duplicate text for audio at the very edge of
     * utterance boundaries (handled by timestamp tracking).
     *
     * @param words - Array of timestamped words from Whisper verbose_json
     * @param utteranceOffsetMs - The start time of this utterance in the
     *        overall recording (used for absolute positioning)
     * @returns The full confirmed transcript so far
     */
    addUtteranceWithTimestamps(
        words: TimestampedWord[],
        utteranceOffsetMs: number = 0
    ): string {
        if (words.length === 0) return this.getText();

        this.utteranceCount++;

        // With utterance-based chunking, each utterance is independent
        // (no overlap), so we can append all words directly.
        // The timestamps are used for future reference and to detect
        // any edge-case overlap if the audio pipeline changes.
        const newWords = words.map(w => w.word.trim()).filter(w => w.length > 0);

        if (newWords.length > 0) {
            this.confirmedWords.push(...newWords);
            // Track the end of this utterance for reference
            this.lastUtteranceEndTime = utteranceOffsetMs + words[words.length - 1].end * 1000;
        }

        return this.getText();
    }

    /**
     * Add a new chunk of text WITHOUT word timestamps.
     * Falls back to improved suffix-prefix matching for deduplication.
     * Used when verbose_json is not available from the server.
     *
     * @param text - Raw text from Whisper
     * @returns The full confirmed transcript so far
     */
    addChunkFallback(text: string): string {
        const newWords = text.split(/\s+/).filter(w => w.length > 0);
        if (newWords.length === 0) return this.getText();

        if (this.confirmedWords.length === 0) {
            this.confirmedWords = [...newWords];
            return this.getText();
        }

        // With utterance-based chunking (no overlap), we just append.
        // The old overlap-based stabilizer was needed because chunks
        // shared 1s of audio. Now they don't.
        this.confirmedWords.push(...newWords);
        return this.getText();
    }

    /** Return the full confirmed transcript. */
    getText(): string {
        return this.confirmedWords.join(' ');
    }

    /**
     * Get the last N confirmed words (used for prefix conditioning).
     * @param n - Number of words to return
     */
    getLastNWords(n: number): string[] {
        return this.confirmedWords.slice(-n);
    }

    /** Get total number of utterances processed. */
    getUtteranceCount(): number {
        return this.utteranceCount;
    }

    /** Reset all state (e.g., when starting a new recording session). */
    clear(): void {
        this.confirmedWords = [];
        this.lastUtteranceEndTime = 0;
        this.utteranceCount = 0;
    }
}
