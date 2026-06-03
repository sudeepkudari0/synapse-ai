import { Mic, MicOff, Camera, Crop, Sparkles, ChevronDown, ChevronUp, X, Loader2, MessageCircle, History, GraduationCap, Code2, Home } from 'lucide-react';
import { IconButton } from '../shared/IconButton';
import { PulsingDot } from '../shared/PulsingDot';
import { useDrag } from '../../hooks/useDrag';
import { useUIStore } from '../../state/ui-store';

interface WidgetHeaderProps {
    isRecording: boolean;
    isExpanded: boolean;
    isCapturing: boolean;
    isGenerating: boolean;
    sessionTime: number;
    hasTranscript: boolean;
    onToggleRecording: () => void;
    onToggleExpanded: () => void;
    onCaptureScreen: () => void;
    onRegionCapture: () => void;
    onGenerateAnswer: () => void;

    onToggleChat: () => void;
    onToggleHistory: () => void;
    onTogglePractice: () => void;
    onDrag: (deltaX: number, deltaY: number) => void;
    onClose: () => void;
}

export function WidgetHeader({
    isRecording,
    isExpanded,
    isCapturing,
    isGenerating,
    sessionTime,
    hasTranscript,
    onToggleRecording,
    onToggleExpanded,
    onCaptureScreen,
    onRegionCapture,
    onGenerateAnswer,

    onToggleChat,
    onToggleHistory,
    onTogglePractice,
    onDrag,
    onClose,
}: WidgetHeaderProps) {
    const { onMouseDown } = useDrag(onDrag);
    const { isCodeMode, toggleCodeMode } = useUIStore();

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div
            className="widget-header flex items-center gap-1 px-3 select-none"
            style={{ height: 'var(--header-height)', cursor: 'grab' }}
            onMouseDown={onMouseDown}
            id="widget-header"
        >
            {/* Recording indicator + mic toggle */}
            <div className="flex items-center gap-2 mr-1">
                <PulsingDot isActive={isRecording} size="md" />
                <IconButton
                    id="btn-toggle-recording"
                    onClick={onToggleRecording}
                    title={isRecording ? 'Stop Recording (Ctrl+Shift+R)' : 'Start Recording (Ctrl+Shift+R)'}
                    variant={isRecording ? 'ghost' : 'ghost'}
                >
                    {isRecording ? (
                        <Mic className="w-4 h-4 text-[var(--accent-red)]" />
                    ) : (
                        <MicOff className="w-4 h-4" />
                    )}
                </IconButton>
            </div>

            {/* Timer — only visible when recording */}
            {isRecording && (
                <div className="font-mono text-xs text-[var(--text-secondary)] tabular-nums min-w-[40px] animate-fade-in">
                    {formatTime(sessionTime)}
                </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons */}
            <div className="flex items-center gap-0.5">
                {/* Screen Capture */}
                <IconButton
                    id="btn-capture-screen"
                    onClick={onCaptureScreen}
                    title="Capture Screen (Ctrl+Shift+S)"
                    disabled={isCapturing}
                >
                    {isCapturing ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-purple)]" />
                    ) : (
                        <Camera className="w-4 h-4" />
                    )}
                </IconButton>

                {/* Region Capture */}
                <IconButton
                    id="btn-region-capture"
                    onClick={onRegionCapture}
                    title="Region Capture (Ctrl+Shift+A)"
                    disabled={isCapturing}
                >
                    <Crop className="w-4 h-4" />
                </IconButton>

                {/* Code Mode Toggle */}
                <IconButton
                    id="btn-toggle-code-mode"
                    onClick={toggleCodeMode}
                    title={isCodeMode ? 'Code Mode ON (captures use coding prompts)' : 'Code Mode OFF'}
                    className={isCodeMode ? '!text-emerald-400 !bg-emerald-500/15 ring-1 ring-emerald-500/30' : ''}
                >
                    <Code2 className="w-4 h-4" />
                </IconButton>

                {/* Generate Answer */}
                <IconButton
                    id="btn-generate-answer"
                    onClick={onGenerateAnswer}
                    title="Generate Answer (Ctrl+Shift+G)"
                    disabled={!hasTranscript || isGenerating}
                >
                    {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-blue)]" />
                    ) : (
                        <Sparkles className="w-4 h-4" />
                    )}
                </IconButton>

                {/* Practice Mode */}
                <IconButton
                    id="btn-toggle-practice"
                    onClick={onTogglePractice}
                    title="Practice Mode"
                >
                    <GraduationCap className="w-4 h-4" />
                </IconButton>

                {/* Back to Dashboard */}
                <IconButton
                    id="btn-back-dashboard"
                    onClick={() => {
                        (window as any).electronAPI?.switchToDashboard?.();
                    }}
                    title="Back to Dashboard"
                >
                    <Home className="w-4 h-4" />
                </IconButton>

                {/* History */}
                <IconButton
                    id="btn-toggle-history"
                    onClick={onToggleHistory}
                    title="Interview History"
                >
                    <History className="w-4 h-4" />
                </IconButton>

                {/* Chat */}
                <IconButton
                    id="btn-toggle-chat"
                    onClick={onToggleChat}
                    title="AI Chat"
                >
                    <MessageCircle className="w-4 h-4" />
                </IconButton>

                {/* Divider */}
                <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

                {/* Toggle expand/collapse */}
                <IconButton
                    id="btn-toggle-expand"
                    onClick={onToggleExpanded}
                    title={isExpanded ? 'Collapse (Ctrl+Shift+H)' : 'Expand (Ctrl+Shift+H)'}
                >
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                    ) : (
                        <ChevronDown className="w-4 h-4" />
                    )}
                </IconButton>

                {/* Close */}
                <IconButton
                    id="btn-close-app"
                    onClick={onClose}
                    title="Close App"
                    className="hover:!text-[var(--accent-red)]"
                >
                    <X className="w-4 h-4" />
                </IconButton>
            </div>
        </div>
    );
}
