import { useRef, useEffect } from 'react';
import { WidgetHeader } from './WidgetHeader';
import { TranscriptPanel } from './TranscriptPanel';
import { AnswerPanel, Answer } from './AnswerPanel';
import './FloatingWidget.css';

interface FloatingWidgetProps {
    // State
    isExpanded: boolean;
    isRecording: boolean;
    isCapturing: boolean;
    isGenerating: boolean;
    sessionTime: number;
    transcript: string;
    answers: Answer[];
    currentAnswerIndex: number;
    isModelLoading: boolean;
    modelError: string;

    // Actions
    onToggleExpanded: () => void;
    onToggleRecording: () => void;
    onCaptureScreen: () => void;
    onGenerateAnswer: () => void;
    onClearTranscript: () => void;
    onClearAnswers: () => void;
    onNavigateAnswer: (index: number) => void;
    onClose: () => void;
}

export function FloatingWidget({
    isExpanded,
    isRecording,
    isCapturing,
    isGenerating,
    sessionTime,
    transcript,
    answers,
    currentAnswerIndex,
    isModelLoading,
    modelError,
    onToggleExpanded,
    onToggleRecording,
    onCaptureScreen,
    onGenerateAnswer,
    onClearTranscript,
    onClearAnswers,
    onNavigateAnswer,
    onClose,
}: FloatingWidgetProps) {
    const widgetRef = useRef<HTMLDivElement>(null);

    // ─── Click-through management ───
    // Widget-level: when mouse enters the widget container, disable click-through.
    // When mouse leaves, re-enable click-through so transparent areas pass clicks.
    useEffect(() => {
        const el = widgetRef.current;
        if (!el) return;

        const handleEnter = () => {
            window.electronAPI?.setIgnoreMouseEvents(false);
        };
        const handleLeave = () => {
            window.electronAPI?.setIgnoreMouseEvents(true);
        };

        el.addEventListener('mouseenter', handleEnter);
        el.addEventListener('mouseleave', handleLeave);

        return () => {
            el.removeEventListener('mouseenter', handleEnter);
            el.removeEventListener('mouseleave', handleLeave);
        };
    }, []);

    // Auto-expand when answers arrive
    const prevAnswerCount = useRef(answers.length);
    useEffect(() => {
        if (answers.length > prevAnswerCount.current) {
            // New answer arrived — expand widget
            if (!isExpanded) {
                onToggleExpanded();
            }
        }
        prevAnswerCount.current = answers.length;
    }, [answers.length, isExpanded, onToggleExpanded]);

    return (
        <div className="fixed top-0 right-0 w-full h-full pointer-events-none select-none z-50">
            <div
                ref={widgetRef}
                className={`widget pointer-events-auto ${isExpanded ? 'widget--expanded' : 'widget--collapsed'}`}
                id="floating-widget"
            >
                {/* Header — always visible */}
                <WidgetHeader
                    isRecording={isRecording}
                    isExpanded={isExpanded}
                    isCapturing={isCapturing}
                    isGenerating={isGenerating}
                    sessionTime={sessionTime}
                    hasTranscript={!!transcript}
                    onToggleRecording={onToggleRecording}
                    onToggleExpanded={onToggleExpanded}
                    onCaptureScreen={onCaptureScreen}
                    onGenerateAnswer={onGenerateAnswer}
                    onClose={onClose}
                />

                {/* Expandable content */}
                <div className="widget-body">
                    {/* Loading indicator */}
                    {isModelLoading && (
                        <div className="px-4 py-3 border-t border-[var(--border-subtle)] animate-slide-up">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)] animate-pulse" />
                                <span className="text-xs text-[var(--text-secondary)]">Loading Whisper model...</span>
                            </div>
                        </div>
                    )}

                    {/* Error display */}
                    {modelError && (
                        <div className="px-4 py-3 border-t border-[var(--border-subtle)] animate-slide-up">
                            <div className="px-3 py-2 rounded-lg bg-[var(--accent-red-dim)] border border-[var(--accent-red)]/20">
                                <p className="text-xs text-[var(--accent-red)]">{modelError}</p>
                            </div>
                        </div>
                    )}

                    {/* Transcript panel */}
                    <TranscriptPanel
                        transcript={transcript}
                        onClear={onClearTranscript}
                    />

                    {/* Answer panel */}
                    {answers.length > 0 && (
                        <AnswerPanel
                            answers={answers}
                            currentIndex={currentAnswerIndex}
                            onNavigate={onNavigateAnswer}
                            onClear={onClearAnswers}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Re-export Answer type for use in App.tsx
export type { Answer } from './AnswerPanel';
