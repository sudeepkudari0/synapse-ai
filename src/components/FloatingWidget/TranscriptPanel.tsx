import { useRef, useEffect } from 'react';
import { Trash2, Mic } from 'lucide-react';
import { IconButton } from '../shared/IconButton';
import type { ChatBlock } from '../../state';

interface TranscriptPanelProps {
    conversation: ChatBlock[];
    onClear: () => void;
    isRecording?: boolean;
    sttEngine?: string; // Display name like 'Whisper.cpp' or 'Moonshine'
    sttModel?: string; // e.g. 'small.en' or 'MEDIUM_STREAMING'
    audioLevels?: { mic: number; system: number }; // 0-1 normalized
}

export function TranscriptPanel({
    conversation,
    onClear,
    isRecording,
    sttEngine = 'Whisper.cpp',
    sttModel = '',
    audioLevels = { mic: 0, system: 0 },
}: TranscriptPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom as new text comes in
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [conversation]);

    // Combined audio level (max of mic + system)
    const combinedLevel = Math.max(audioLevels.mic, audioLevels.system);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                        {isRecording ? 'Transcribing...' : 'Transcript'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800/80 border border-zinc-700/40">
                        <Mic className="w-3 h-3 text-zinc-400" />
                        <span className="text-[10px] text-zinc-400 font-medium">
                            {sttEngine} {sttModel ? <span className="opacity-60 font-mono tracking-tighter">({sttModel})</span> : ''}
                        </span>
                    </div>
                    {conversation.length > 0 && (
                        <IconButton
                            id="btn-clear-transcript"
                            onClick={onClear}
                            title="Clear transcript"
                            size="sm"
                        >
                            <Trash2 className="w-3 h-3" />
                        </IconButton>
                    )}
                </div>
            </div>

            {/* Conversation list */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3 select-text"
            >
                {(!conversation || conversation.length === 0) ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-[var(--text-muted)] text-xs">
                            Live Transcription...
                        </p>
                    </div>
                ) : (
                    conversation.map((block, idx) => {
                        const isUser = block.speaker === 'user';
                        const isLatestInterviewer = !isUser && 
                            idx === conversation.length - 1;
                        return (
                            <div 
                                key={block.id} 
                                className={`text-[13px] leading-relaxed ${
                                    isLatestInterviewer ? 'font-semibold text-white' : ''
                                }`}
                            >
                                <span className={`font-bold mr-1.5 ${isUser ? 'text-[#38bdf8]' : 'text-[#34d399]'}`}>
                                    {isUser ? 'ME:' : 'Interviewer:'}
                                </span>
                                <span className={isLatestInterviewer ? 'text-white' : 'text-[var(--text-primary)]'}>
                                    {block.text}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Audio waveform — driven by actual audio levels */}
            {isRecording && (
                <div className="shrink-0 px-4 py-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-center gap-[2px] h-6">
                        {Array.from({ length: 40 }).map((_, i) => {
                            // Each bar gets a slightly different "response" based on position
                            const positionFactor = 1 - Math.abs(i - 20) / 20; // Peak in center
                            const jitter = Math.sin(i * 0.7 + Date.now() * 0.001) * 0.15;
                            const barLevel = combinedLevel > 0.01
                                ? Math.max(0.15, (combinedLevel * positionFactor + jitter) * 1.2)
                                : 0.1; // Flat baseline when silent

                            return (
                                <div
                                    key={i}
                                    className="w-[2px] rounded-full transition-all duration-150"
                                    style={{
                                        height: `${Math.max(3, barLevel * 22)}px`,
                                        backgroundColor: combinedLevel > 0.01
                                            ? `rgba(99, 179, 237, ${0.4 + barLevel * 0.5})`
                                            : 'rgba(113, 113, 122, 0.3)',
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
