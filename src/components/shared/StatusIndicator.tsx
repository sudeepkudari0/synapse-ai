import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';

interface StatusIndicatorProps {
    isWhisperLoaded: boolean;
    isWhisperLoading: boolean;
    whisperError?: string | null;
    isRecording: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
    isWhisperLoaded,
    isWhisperLoading,
    whisperError,
    isRecording,
}) => {
    const getStatus = () => {
        if (whisperError) return { icon: AlertCircle, text: 'Model Error', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
        if (isWhisperLoading) return { icon: Loader2, text: 'Loading Model...', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', animate: true };
        if (!isWhisperLoaded) return { icon: WifiOff, text: 'No Model', color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' };
        if (isRecording) return { icon: Wifi, text: 'Listening', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
        return { icon: CheckCircle2, text: 'Ready', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    };

    const status = getStatus();
    const Icon = status.icon;

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${status.bg} ${status.color} border ${status.border} transition-colors`}>
            <Icon className={`w-3 h-3 ${(status as any).animate ? 'animate-spin' : ''}`} />
            <span>{status.text}</span>
        </div>
    );
};
