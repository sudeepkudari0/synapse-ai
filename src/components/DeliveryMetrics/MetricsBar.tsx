import { useEffect, useState } from 'react';
import { analyzeDelivery, DeliveryMetrics } from '../../lib/delivery-analyzer';
import { ChatBlock } from '../../state';
import { Mic, FileText, Activity } from 'lucide-react';

interface MetricsBarProps {
    conversation: ChatBlock[];
    sessionTime: number;
    isRecording: boolean;
}

export function MetricsBar({ conversation, sessionTime, isRecording }: MetricsBarProps) {
    const [metrics, setMetrics] = useState<DeliveryMetrics | null>(null);
    const [isEnabled, setIsEnabled] = useState(true);

    // Fetch settings on mount
    useEffect(() => {
        window.electronAPI.getSettings().then(res => {
            if (res.success && res.settings) {
                setIsEnabled(res.settings.showDeliveryMetrics !== false);
            }
        });
    }, []);

    // Update metrics every 5 seconds instead of every frame to save performance
    useEffect(() => {
        if (!isRecording) return;

        const interval = setInterval(() => {
            const result = analyzeDelivery(conversation, sessionTime);
            setMetrics(result);
        }, 5000);

        return () => clearInterval(interval);
    }, [conversation, sessionTime, isRecording]);

    if (!isRecording || !metrics || !isEnabled) return null;

    return (
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950 border-t border-zinc-800 text-[10px] text-zinc-400 select-none">
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-1" title="Candidate Talk Time Ratio">
                    <Mic className="w-3 h-3 text-indigo-400" />
                    {Math.round(metrics.talkTimeRatio * 100)}% Talk
                </span>
                <span className="flex items-center gap-1" title="Filler Words Detected">
                    <FileText className="w-3 h-3 text-amber-400" />
                    {metrics.fillerWordCount} Fillers
                </span>
                <span className="flex items-center gap-1" title="Estimated Words Per Minute">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    {metrics.wpm} WPM
                </span>
            </div>
            {metrics.fillerWordCount > 10 && (
                <span className="text-amber-500 font-medium animate-pulse">
                    Pacing warning
                </span>
            )}
        </div>
    );
}
