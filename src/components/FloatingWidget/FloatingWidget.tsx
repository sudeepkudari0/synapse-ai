import { useRef, useEffect, useState } from 'react';
import { WidgetHeader } from './WidgetHeader';
import { TranscriptPanel } from './TranscriptPanel';
import { AnswerPanel } from './AnswerPanel';
import { SettingsPanel } from '../SettingsPanel/SettingsPanel';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { SessionHistory } from '../SessionHistory/SessionHistory';
import { SessionDetail } from '../SessionHistory/SessionDetail';
import { MetricsBar } from '../DeliveryMetrics/MetricsBar';
import type { ChatBlock, Answer } from '../../state';
import './FloatingWidget.css';

interface FloatingWidgetProps {
    // State
    isExpanded: boolean;
    isSettingsOpen: boolean;
    isChatOpen: boolean;
    isHistoryOpen: boolean;
    isRecording: boolean;
    isCapturing: boolean;
    isGenerating: boolean;
    sessionTime: number;
    conversation: ChatBlock[];
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
    onToggleSettings: () => void;
    onToggleChat: () => void;
    onToggleHistory: () => void;
    onSettingsChanged: () => void;
    onClose: () => void;
}

export function FloatingWidget({
    isExpanded,
    isSettingsOpen,
    isChatOpen,
    isRecording,
    isCapturing,
    isGenerating,
    sessionTime,
    conversation,
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
    onToggleSettings,
    onToggleChat,
    onToggleHistory,
    onSettingsChanged,
    onClose,
}: FloatingWidgetProps) {
    const widgetRef = useRef<HTMLDivElement>(null);
    const prevAnswerCount = useRef(answers.length);
    const [selectedSession, setSelectedSession] = useState<any>(null);

    // Reset selected session when history is toggled
    useEffect(() => {
        if (!isHistoryOpen) {
            setSelectedSession(null);
        }
    }, [isHistoryOpen]);

    const handleLoadSession = async (id: string) => {
        try {
            const res = await window.electronAPI.session.load(id);
            if (res.success && res.session) {
                setSelectedSession(res.session);
            }
        } catch (error) {
            console.error('Failed to load session details:', error);
        }
    };

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
                    hasTranscript={conversation && conversation.length > 0}
                    onToggleRecording={onToggleRecording}
                    onToggleExpanded={onToggleExpanded}
                    onCaptureScreen={onCaptureScreen}
                    onGenerateAnswer={onGenerateAnswer}
                    onOpenSettings={onToggleSettings}
                    onToggleChat={onToggleChat}
                    onToggleHistory={onToggleHistory}
                    onClose={onClose}
                />

                {/* Expandable content */}
                <div className="widget-body">
                    {/* Settings/Chat/History Panels override other content when open */}
                    {isSettingsOpen ? (
                        <SettingsPanel 
                            onClose={onToggleSettings} 
                            onSettingsChanged={onSettingsChanged} 
                        />
                    ) : isChatOpen ? (
                        <ChatPanel onClose={onToggleChat} />
                    ) : isHistoryOpen ? (
                        selectedSession ? (
                            <SessionDetail 
                                session={selectedSession} 
                                onClose={onToggleHistory} 
                                onBack={() => setSelectedSession(null)} 
                            />
                        ) : (
                            <SessionHistory 
                                onClose={onToggleHistory} 
                                onLoadSession={handleLoadSession} 
                            />
                        )
                    ) : (
                        <>
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
                                conversation={conversation}
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

                            {/* Delivery Metrics Bar */}
                            <MetricsBar 
                                conversation={conversation} 
                                sessionTime={sessionTime} 
                                isRecording={isRecording} 
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// Re-export Answer type for convenience
export type { Answer } from '../../state';
