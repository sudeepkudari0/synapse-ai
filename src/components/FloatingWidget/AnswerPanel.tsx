import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2, MessageSquare, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
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
    const [showFollowUps, setShowFollowUps] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const current = answers[currentIndex];

    // Auto-scroll to bottom during streaming
    useEffect(() => {
        if (current?.isStreaming && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [current?.answer, current?.isStreaming]);

    // Reset follow-ups toggle when answer changes
    useEffect(() => {
        setShowFollowUps(false);
    }, [currentIndex]);

    if (!current) return null;

    return (
        <div className="panel-section animate-slide-up">
            {/* Section header with navigation */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        AI Response
                    </span>
                    {current.detectedType && current.detectedType !== 'general' && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 ml-1">
                            Detected: {current.detectedType.replace('-', ' ')}
                        </span>
                    )}

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

                {/* Follow-ups */}
                {current.followUps && current.followUps.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
                        <button 
                            onClick={() => setShowFollowUps(!showFollowUps)}
                            className="flex items-center text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            {showFollowUps ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRightIcon className="w-3.5 h-3.5 mr-1" />}
                            Likely Follow-up Questions
                        </button>
                        
                        {showFollowUps && (
                            <ul className="mt-2 space-y-2 animate-fade-in pl-1">
                                {current.followUps.map((q, i) => (
                                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-1.5">
                                        <MessageSquare className="w-3 h-3 text-indigo-500/70 mt-0.5 shrink-0" />
                                        <span>{q}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
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
