import { useState, useRef, useEffect } from 'react';
import { Trash2, Sparkles, Copy, Check, Zap, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { CandidateQuestion, DetectedQuestion, AnswerOption } from '../../state';

interface AnswerSuggestionsProps {
    candidateQuestions: CandidateQuestion[];
    detectedQuestions: DetectedQuestion[];
    expandedQuestionId: string | null;
    onPickQuestion: (candidateId: string, questionText: string) => void;
    onDismissCandidate: (candidateId: string) => void;
    onSelectOption: (questionId: string, optionId: string) => void;
    onClearAll: () => void;
}

// Color themes for each answer option style
const OPTION_THEMES: Record<string, { border: string; label: string; bg: string; glow: string }> = {
    strategic: {
        border: 'border-cyan-500/40',
        label: 'text-cyan-400',
        bg: 'bg-cyan-500/5',
        glow: 'hover:shadow-[0_0_20px_rgba(6,182,212,0.08)]',
    },
    technological: {
        border: 'border-blue-500/40',
        label: 'text-blue-400',
        bg: 'bg-blue-500/5',
        glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]',
    },
    'process-driven': {
        border: 'border-emerald-500/40',
        label: 'text-emerald-400',
        bg: 'bg-emerald-500/5',
        glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]',
    },
};

const STYLE_LABELS: Record<string, string> = {
    strategic: 'Focused/Strategic',
    technological: 'Technological',
    'process-driven': 'Process-Driven',
};

// ─── Answer Option Card ───

function OptionCard({
    option,
    index,
    questionId,
    isSelected,
    onSelect,
}: {
    option: AnswerOption;
    index: number;
    questionId: string;
    isSelected: boolean;
    onSelect: (questionId: string, optionId: string) => void;
}) {
    const [copied, setCopied] = useState(false);
    const theme = OPTION_THEMES[option.style] || OPTION_THEMES.strategic;
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (option.isStreaming && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [option.answer, option.isStreaming]);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(option.answer);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const previewText = option.answer
        ? option.answer.replace(/[#*_`\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
        : '';

    return (
        <div
            className={`
                relative rounded-xl border transition-all duration-200 cursor-pointer
                ${theme.border} ${theme.bg} ${theme.glow}
                ${isSelected ? 'ring-1 ring-white/10' : ''}
            `}
            onClick={() => onSelect(questionId, option.id)}
        >
            <div className="px-3.5 pt-3 pb-1 flex items-center justify-between">
                <span className={`text-xs font-bold ${theme.label}`}>
                    Option {index + 1} ({STYLE_LABELS[option.style] || option.styleLabel})
                </span>
                {option.answer && !option.isStreaming && (
                    <button
                        onClick={handleCopy}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                        title="Copy answer"
                    >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                )}
            </div>

            <div ref={scrollRef} className={`px-3.5 pb-3 ${isSelected ? 'max-h-[300px] overflow-y-auto' : ''}`}>
                {option.isStreaming && !option.answer ? (
                    <div className="flex items-center gap-2 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-xs text-zinc-500">Generating...</span>
                    </div>
                ) : isSelected ? (
                    <div className="text-[13px] leading-relaxed text-[var(--text-primary)] answer-content prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                            components={{
                                code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const isInline = !match;
                                    if (isInline) {
                                        return (
                                            <code className="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                                {children}
                                            </code>
                                        );
                                    }
                                    return (
                                        <pre className="!bg-zinc-900 !m-0 p-3 rounded-lg overflow-x-auto my-2 border border-zinc-700/50">
                                            <code className={`${className || ''} text-xs font-mono`} {...props}>{children}</code>
                                        </pre>
                                    );
                                },
                            }}
                        >
                            {option.answer}
                        </ReactMarkdown>
                        {option.isStreaming && <span className="streaming-cursor" />}
                    </div>
                ) : (
                    <p className="text-[13px] leading-relaxed text-zinc-300">
                        {previewText}
                        {previewText.length >= 120 && (
                            <span className={`ml-1 ${theme.label} text-xs font-medium`}>(Read more)</span>
                        )}
                        {option.isStreaming && <span className="streaming-cursor" />}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── Candidate Question Card (pending, clickable to trigger answering) ───

function CandidateCard({
    candidate,
    onPick,
    onDismiss,
}: {
    candidate: CandidateQuestion;
    onPick: (id: string, text: string) => void;
    onDismiss: (id: string) => void;
}) {
    const isAnswering = candidate.status === 'answering';

    return (
        <div
            className={`
                rounded-xl border transition-all duration-200
                ${isAnswering
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:border-cyan-500/30 hover:bg-cyan-500/5 cursor-pointer hover:shadow-[0_0_20px_rgba(6,182,212,0.06)]'
                }
            `}
            onClick={() => !isAnswering && onPick(candidate.id, candidate.text)}
        >
            <div className="px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        {/* Status indicator */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                            {isAnswering ? (
                                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                            ) : (
                                <Zap className="w-3 h-3 text-cyan-500/60" />
                            )}
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                isAnswering ? 'text-amber-400' : 'text-cyan-500/60'
                            }`}>
                                {isAnswering ? 'Generating answers...' : 'Detected Question'}
                            </span>
                            {/* Confidence badge */}
                            <span className="text-[9px] text-zinc-600 ml-auto">
                                {Math.round(candidate.confidence * 100)}%
                            </span>
                        </div>

                        {/* Question text */}
                        <p className="text-[13px] leading-relaxed text-zinc-200 line-clamp-3">
                            {candidate.text}
                        </p>

                        {/* Click hint */}
                        {!isAnswering && (
                            <p className="text-[10px] text-cyan-500/40 mt-2 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Click to generate answer options
                            </p>
                        )}
                    </div>

                    {/* Dismiss button */}
                    {!isAnswering && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDismiss(candidate.id); }}
                            className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5 shrink-0"
                            title="Dismiss"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───

export function AnswerSuggestions({
    candidateQuestions,
    detectedQuestions,
    onPickQuestion,
    onDismissCandidate,
    onSelectOption,
    onClearAll,
}: AnswerSuggestionsProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to top when new questions arrive
    useEffect(() => {
        if (scrollRef.current && (candidateQuestions.length > 0 || detectedQuestions.length > 0)) {
            scrollRef.current.scrollTop = 0;
        }
    }, [candidateQuestions.length, detectedQuestions.length]);

    const totalCount = candidateQuestions.length + detectedQuestions.length;

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                        AI Answer Suggestions
                    </span>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/50">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span className="text-[9px] text-zinc-400 font-medium">Ollama</span>
                    </div>
                </div>
                {totalCount > 0 && (
                    <button
                        onClick={onClearAll}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                        title="Clear all suggestions"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-3">
                {totalCount === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center mb-3">
                            <Sparkles className="w-5 h-5 text-zinc-600" />
                        </div>
                        <p className="text-xs text-zinc-500 max-w-[200px]">
                            Detected questions will appear here — click one to generate answer options
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Pending candidate questions (waiting for user to pick) */}
                        {candidateQuestions.filter(q => q.status === 'pending').map((candidate) => (
                            <CandidateCard
                                key={candidate.id}
                                candidate={candidate}
                                onPick={onPickQuestion}
                                onDismiss={onDismissCandidate}
                            />
                        ))}

                        {/* Answered questions with their option cards */}
                        {detectedQuestions.map((question) => (
                            <div key={question.id} className="space-y-2 animate-slide-up">
                                {/* Question text label */}
                                <div className="px-1 pb-1">
                                    <p className="text-[11px] text-zinc-500 font-medium truncate" title={question.questionText}>
                                        Q: {question.questionText}
                                    </p>
                                </div>

                                {/* Answer option cards */}
                                {question.options.map((option, idx) => (
                                    <OptionCard
                                        key={option.id}
                                        option={option}
                                        index={idx}
                                        questionId={question.id}
                                        isSelected={question.selectedOptionId === option.id}
                                        onSelect={onSelectOption}
                                    />
                                ))}

                                {/* Separator */}
                                <div className="border-t border-zinc-800/60 mt-2 pt-1" />
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
