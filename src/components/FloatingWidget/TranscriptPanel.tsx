import { useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { IconButton } from '../shared/IconButton';
import type { ChatBlock } from '../../state';

interface TranscriptPanelProps {
    conversation: ChatBlock[];
    onClear: () => void;
}

export function TranscriptPanel({ conversation, onClear }: TranscriptPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom as new text comes in
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [conversation]);

    if (!conversation || conversation.length === 0) {
        return (
            <div className="panel-section">
                <div className="px-4 py-6 text-center">
                    <p className="text-[var(--text-muted)] text-xs">
                        Live Transcription...
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

            {/* Conversation list */}
            <div
                ref={scrollRef}
                className="px-4 py-3 max-h-[160px] overflow-y-auto space-y-3 select-text"
            >
                {conversation.map((block) => {
                    const isUser = block.speaker === 'user';
                    return (
                        <div key={block.id} className="text-[13px] leading-relaxed">
                            <span className={`font-bold mr-1.5 ${isUser ? 'text-[#38bdf8]' : 'text-[#34d399]'}`}>
                                {isUser ? 'ME:' : 'Interviewer:'}
                            </span>
                            <span className="text-[var(--text-primary)]">
                                {block.text}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
