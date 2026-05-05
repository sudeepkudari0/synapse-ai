import { useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { IconButton } from '../shared/IconButton';

interface TranscriptPanelProps {
    transcript: string;
    onClear: () => void;
}

export function TranscriptPanel({ transcript, onClear }: TranscriptPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom as new text comes in
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript]);

    if (!transcript) {
        return (
            <div className="panel-section">
                <div className="px-4 py-6 text-center">
                    <p className="text-[var(--text-muted)] text-xs">
                        Start recording to see live transcription...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel-section animate-slide-up">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Transcript
                </span>
                <IconButton
                    id="btn-clear-transcript"
                    onClick={onClear}
                    title="Clear transcript"
                    size="sm"
                >
                    <Trash2 className="w-3 h-3" />
                </IconButton>
            </div>

            {/* Transcript text */}
            <div
                ref={scrollRef}
                className="px-4 py-3 max-h-[120px] overflow-y-auto"
            >
                <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                    {transcript}
                </p>
            </div>
        </div>
    );
}
