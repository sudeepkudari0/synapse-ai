import { X, Copy, ChevronLeft, Clock, FileText } from 'lucide-react';
import { ChatBlock, Answer } from '../../state';

interface SessionDetailProps {
    session: {
        id: string;
        timestamp: string;
        duration: number;
        type: string;
        transcript: ChatBlock[];
        answers: Answer[];
    };
    onClose: () => void;
    onBack: () => void;
}

export function SessionDetail({ session, onClose, onBack }: SessionDetailProps) {
    const handleCopyMarkdown = () => {
        let md = `# Interview Session: ${new Date(session.timestamp).toLocaleString()}\n`;
        md += `- **Duration:** ${Math.floor(session.duration / 60)}m ${session.duration % 60}s\n`;
        md += `- **Type:** ${session.type}\n\n`;

        md += `## Transcript\n\n`;
        session.transcript.forEach(block => {
            const speaker = block.speaker === 'user' ? 'Candidate' : 'Interviewer';
            md += `**${speaker}:** ${block.text}\n\n`;
        });

        md += `## Generated Answers\n\n`;
        session.answers.forEach((answer, idx) => {
            md += `### Q&A ${idx + 1} (${answer.detectedType || 'general'})\n`;
            md += `**Context:**\n${answer.question}\n\n`;
            md += `**AI Response:**\n${answer.answer}\n\n`;
        });

        navigator.clipboard.writeText(md).then(() => {
            // In a real app we might show a toast here
            alert("Copied to clipboard as Markdown!");
        });
    };

    return (
        <div className="flex flex-col border-t border-[var(--border-subtle)] animate-slide-up bg-zinc-900 h-96">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                        title="Back to List"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h2 className="text-sm font-semibold text-white">
                            Session Details
                        </h2>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span>{new Date(session.timestamp).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {Math.floor(session.duration/60)}m {session.duration%60}s</span>
                            <span>•</span>
                            <span className="capitalize">{session.type}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-1">
                    <button 
                        onClick={handleCopyMarkdown}
                        className="px-2 py-1 text-[10px] font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded transition-colors flex items-center gap-1"
                    >
                        <Copy className="w-3 h-3" />
                        Export MD
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors ml-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                <div>
                    <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-zinc-800 pb-1">
                        <FileText className="w-3.5 h-3.5" />
                        Full Transcript
                    </h3>
                    <div className="space-y-3">
                        {session.transcript.map((block, idx) => (
                            <div key={idx} className="text-xs">
                                <span className={`font-semibold mr-2 ${block.speaker === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                    {block.speaker === 'user' ? 'You' : 'Interviewer'}:
                                </span>
                                <span className="text-zinc-300">{block.text}</span>
                            </div>
                        ))}
                        {session.transcript.length === 0 && (
                            <div className="text-zinc-500 text-xs italic">No conversation recorded.</div>
                        )}
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-zinc-800 pb-1">
                        AI Answers Generated
                    </h3>
                    <div className="space-y-4">
                        {session.answers.map((ans, idx) => (
                            <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-[10px] text-zinc-500 font-mono">#{idx + 1}</div>
                                    <div className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded capitalize">
                                        {ans.detectedType || session.type || 'general'}
                                    </div>
                                </div>
                                <div className="text-xs text-zinc-300 mb-2 pb-2 border-b border-zinc-800/50">
                                    <span className="font-semibold text-zinc-400 block mb-1">Context:</span>
                                    <span className="line-clamp-2 italic">{ans.question}</span>
                                </div>
                                <div className="text-xs text-white whitespace-pre-wrap">
                                    {ans.answer}
                                </div>
                            </div>
                        ))}
                        {session.answers.length === 0 && (
                            <div className="text-zinc-500 text-xs italic">No answers generated.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
