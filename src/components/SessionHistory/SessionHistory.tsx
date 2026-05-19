import { useState, useEffect } from 'react';
import { X, Trash2, Clock, Calendar, FileText } from 'lucide-react';

interface SessionItem {
    id: string;
    startTime: string;
    duration: number;
    interviewType: string;
    questionCount: number;
}

interface SessionHistoryProps {
    onClose: () => void;
    onLoadSession: (sessionId: string) => void;
}

export function SessionHistory({ onClose, onLoadSession }: SessionHistoryProps) {
    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setIsLoading(true);
        try {
            const res = await window.electronAPI.session.list();
            if (res.success && res.sessions) {
                // Sort by timestamp descending
                const sorted = res.sessions.sort((a: any, b: any) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                setSessions(sorted);
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this session?')) {
            try {
                const res = await window.electronAPI.session.delete(id);
                if (res.success) {
                    setSessions(sessions.filter(s => s.id !== id));
                }
            } catch (error) {
                console.error('Failed to delete session:', error);
            }
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col flex-1 h-full border-t border-[var(--border-subtle)] animate-slide-up bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Interview History
                </h2>
                <button 
                    onClick={onClose}
                    className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                {isLoading ? (
                    <div className="text-center text-zinc-500 text-xs py-8">Loading history...</div>
                ) : sessions.length === 0 ? (
                    <div className="text-center text-zinc-500 text-xs py-8">
                        No recorded sessions found.<br/>
                        Start recording to save your interviews.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sessions.map(session => (
                            <div 
                                key={session.id}
                                onClick={() => onLoadSession(session.id)}
                                className="group bg-zinc-950 border border-zinc-800 hover:border-indigo-500/50 rounded-lg p-3 cursor-pointer transition-all hover:bg-zinc-900"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-medium text-white text-xs">
                                        {new Date(session.startTime).toLocaleDateString(undefined, {
                                            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                        })}
                                    </div>
                                    <button 
                                        onClick={(e) => handleDelete(e, session.id)}
                                        className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete Session"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-4 text-[10px] text-zinc-400">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(session.duration)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {session.interviewType || 'general'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <FileText className="w-3 h-3" />
                                        {session.questionCount} Q&A
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
