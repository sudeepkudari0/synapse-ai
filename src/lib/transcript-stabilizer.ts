/**
 * TranscriptStabilizer — word-level overlap deduplication for streamed
 * Whisper transcription chunks that may share overlapping audio context.
 *
 * When consecutive chunks overlap (e.g. 1 second of shared audio), whisper
 * often produces the same words at the end of chunk N and the start of
 * chunk N+1. This class detects that overlap and only appends the truly
 * new portion of each chunk.
 */
export class TranscriptStabilizer {
    private confirmedWords: string[] = [];
    private lastChunkWords: string[] = [];

    /**
     * Ingest a new chunk of transcript text.
     * Returns the full stabilized transcript so far.
     */
    addChunk(text: string): string {
        const newWords = text.split(/\s+/).filter(w => w.length > 0);
        if (newWords.length === 0) return this.getText();

        if (this.confirmedWords.length === 0) {
            this.confirmedWords = [...newWords];
            this.lastChunkWords = [...newWords];
            return this.getText();
        }

        // Find the longest suffix of the previous chunk that matches
        // a prefix of the new chunk (case-insensitive).
        const maxCheck = Math.min(this.lastChunkWords.length, newWords.length, 15);
        let bestOverlap = 0;

        for (let len = 1; len <= maxCheck; len++) {
            const tail = this.lastChunkWords
                .slice(-len)
                .map(w => w.toLowerCase().replace(/[^a-z0-9']/g, ''))
                .join(' ');
            const head = newWords
                .slice(0, len)
                .map(w => w.toLowerCase().replace(/[^a-z0-9']/g, ''))
                .join(' ');

            if (tail === head) {
                bestOverlap = len;
            }
        }

        const uniqueWords = newWords.slice(bestOverlap);
        if (uniqueWords.length > 0) {
            this.confirmedWords.push(...uniqueWords);
        }

        this.lastChunkWords = [...newWords];
        return this.getText();
    }

    /** Return the full stabilized transcript. */
    getText(): string {
        return this.confirmedWords.join(' ');
    }

    /** Reset all state (e.g. when starting a new recording session). */
    clear(): void {
        this.confirmedWords = [];
        this.lastChunkWords = [];
    }
}
