import { Mic, MicOff, Camera, Sparkles, ChevronDown, ChevronUp, X, Loader2, Settings } from 'lucide-react';
import { IconButton } from '../shared/IconButton';
import { PulsingDot } from '../shared/PulsingDot';
import { useDrag } from '../../hooks/useDrag';

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
    onGenerateAnswer: () => void;
    onOpenSettings: () => void;
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
    onGenerateAnswer,
    onOpenSettings,
    onClose,
}: WidgetHeaderProps) {
    const { onMouseDown } = useDrag();

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

                {/* Settings */}
                <IconButton
                    id="btn-open-settings"
                    onClick={onOpenSettings}
                    title="Settings"
                >
                    <Settings className="w-4 h-4" />
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
