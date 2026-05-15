import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { IconButton } from '../shared/IconButton';
import { CopyButton } from '../shared/CopyButton';
import type { Answer } from '../../state';

interface AnswerPanelProps {
    answers: Answer[];
    currentIndex: number;
    onNavigate: (index: number) => void;
    onClear: () => void;
}

export function AnswerPanel({ answers, currentIndex, onNavigate, onClear }: AnswerPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const current = answers[currentIndex];

    // Auto-scroll to bottom during streaming
    useEffect(() => {
        if (current?.isStreaming && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [current?.answer, current?.isStreaming]);

    if (!current) return null;

    return (
        <div className="panel-section animate-slide-up">
            {/* Section header with navigation */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        AI Response
                    </span>

                    {/* Answer counter */}
                    {answers.length > 1 && (
                        <span className="text-[10px] text-[var(--text-muted)] ml-1">
                            {currentIndex + 1}/{answers.length}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-0.5">
                    {/* Navigation arrows */}
                    {answers.length > 1 && (
                        <>
                            <IconButton
                                id="btn-prev-answer"
                                onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
                                title="Previous answer"
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="w-3 h-3" />
                            </IconButton>
                            <IconButton
                                id="btn-next-answer"
                                onClick={() => onNavigate(Math.min(answers.length - 1, currentIndex + 1))}
                                title="Next answer"
                                disabled={currentIndex === answers.length - 1}
                            >
                                <ChevronRight className="w-3 h-3" />
                            </IconButton>
                        </>
                    )}

                    <IconButton
                        id="btn-clear-answers"
                        onClick={onClear}
                        title="Clear all answers"
                    >
                        <Trash2 className="w-3 h-3" />
                    </IconButton>
                </div>
            </div>

            {/* Source badge */}
            <div className="px-4 pt-3 pb-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                    ${current.source === 'screen-capture'
                        ? 'bg-[var(--accent-purple-dim)] text-[var(--accent-purple)]'
                        : 'bg-[var(--accent-blue-dim)] text-[var(--accent-blue)]'
                    }`}
                >
                    {current.source === 'screen-capture' ? '📷 Screen Capture' : '🎙️ Transcript'}
                </span>
            </div>

            {/* Answer content */}
            <div
                ref={scrollRef}
                className="px-4 py-3 max-h-[300px] overflow-y-auto select-text"
            >
                {/* Question/context */}
                {current.question && current.source === 'transcript' && (
                    <div className="mb-3 pb-3 border-b border-[var(--border-subtle)]">
                        <p className="text-xs text-[var(--text-muted)] mb-1 font-medium">Question:</p>
                        <p className="text-sm text-[var(--text-secondary)] line-clamp-3">
                            {current.question}
                        </p>
                    </div>
                )}

                {/* Answer text */}
                <div className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap answer-content">
                    {current.answer || (
                        <span className="text-[var(--text-muted)]">Generating...</span>
                    )}

                    {/* Streaming cursor */}
                    {current.isStreaming && (
                        <span className="streaming-cursor" />
                    )}
                </div>
            </div>

            {/* Footer actions */}
            {current.answer && !current.isStreaming && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-muted)]">
                        {current.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <CopyButton text={current.answer} />
                </div>
            )}
        </div>
    );
}
