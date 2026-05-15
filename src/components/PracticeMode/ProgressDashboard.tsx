import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Target, BarChart3, ArrowLeft } from 'lucide-react';
import type { SessionProgress } from '../../lib/scoring-engine';
import { getWeakestDimensions, getScoreTrend } from '../../lib/scoring-engine';

interface ProgressDashboardProps {
    onClose: () => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ onClose }) => {
    const [progressData, setProgressData] = useState<SessionProgress[]>([]);
    const [selectedType, setSelectedType] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProgress();
    }, []);

    const loadProgress = async () => {
        try {
            const res = await window.electronAPI.session.list();
            if (res.success && res.sessions) {
                // Filter practice sessions and build progress data
                const practiceSessions = res.sessions.filter(
                    (s: any) => s.tags && s.tags.includes('practice')
                );

                // Load full session data to compute scores
                const progressItems: SessionProgress[] = [];
                for (const summary of practiceSessions.slice(0, 20)) { // Last 20
                    const detail = await window.electronAPI.session.load(summary.id);
                    if (detail.success && detail.session) {
                        const answers = detail.session.answers || [];
                        // Extract scores from answer text (they're embedded as markdown)
                        const scores = answers
                            .map((a: any) => {
                                const scoreMatch = a.answer?.match(/\*\*Evaluation Score:\*\* (\d+(?:\.\d+)?)\/10/);
                                return scoreMatch ? parseFloat(scoreMatch[1]) : null;
                            })
                            .filter((s: number | null): s is number => s !== null);

                        const avgScore = scores.length > 0
                            ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
                            : 0;

                        progressItems.push({
                            sessionId: summary.id,
                            interviewType: summary.interviewType || 'general',
                            date: summary.startTime,
                            averageScore: avgScore,
                            dimensionAverages: {
                                completeness: avgScore,
                                structure: avgScore,
                                specificity: avgScore,
                                relevance: avgScore,
                                communication: avgScore,
                            },
                            questionCount: answers.length,
                        });
                    }
                }

                setProgressData(progressItems);
            }
        } catch (err) {
            console.error('Failed to load progress:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredData = selectedType === 'all'
        ? progressData
        : progressData.filter(s => s.interviewType === selectedType);

    const interviewTypes = [...new Set(progressData.map(s => s.interviewType))];
    const weakest = getWeakestDimensions(filteredData);
    const overallTrend = filteredData.length >= 2
        ? getScoreTrend(filteredData, 'completeness')
        : 'stable';

    const overallAvg = filteredData.length > 0
        ? Math.round((filteredData.reduce((s, p) => s + p.averageScore, 0) / filteredData.length) * 10) / 10
        : 0;

    const TrendIcon = overallTrend === 'improving' ? TrendingUp : overallTrend === 'declining' ? TrendingDown : Minus;
    const trendColor = overallTrend === 'improving' ? 'text-emerald-400' : overallTrend === 'declining' ? 'text-red-400' : 'text-zinc-400';

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-semibold text-white">Practice Progress</h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {isLoading ? (
                    <div className="text-center text-zinc-400 text-sm py-8">Loading progress data...</div>
                ) : filteredData.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm py-8">
                        No practice sessions yet. Complete a mock interview to see your progress!
                    </div>
                ) : (
                    <>
                        {/* Filter */}
                        {interviewTypes.length > 1 && (
                            <div className="flex gap-1.5 flex-wrap">
                                <button
                                    onClick={() => setSelectedType('all')}
                                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                                        selectedType === 'all' ? 'bg-indigo-500/30 text-indigo-300' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    All
                                </button>
                                {interviewTypes.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedType(type)}
                                        className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                                            selectedType === type ? 'bg-indigo-500/30 text-indigo-300' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Overall Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-zinc-800/80 rounded-lg p-3 text-center border border-zinc-700/50">
                                <div className="text-2xl font-bold text-white">{overallAvg}</div>
                                <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1">Avg Score</div>
                            </div>
                            <div className="bg-zinc-800/80 rounded-lg p-3 text-center border border-zinc-700/50">
                                <div className="text-2xl font-bold text-white">{filteredData.length}</div>
                                <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1">Sessions</div>
                            </div>
                            <div className="bg-zinc-800/80 rounded-lg p-3 text-center border border-zinc-700/50">
                                <div className={`flex items-center justify-center gap-1 ${trendColor}`}>
                                    <TrendIcon className="w-5 h-5" />
                                </div>
                                <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1">Trend</div>
                            </div>
                        </div>

                        {/* Score History (text chart) */}
                        <div>
                            <h3 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-indigo-400" />
                                Score History
                            </h3>
                            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/50 p-3 space-y-1.5">
                                {filteredData.slice(-10).map((session, i) => {
                                    const barWidth = Math.round((session.averageScore / 10) * 100);
                                    const date = new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    return (
                                        <div key={session.sessionId} className="flex items-center gap-2 text-xs">
                                            <span className="text-zinc-500 w-12 shrink-0 text-right">{date}</span>
                                            <div className="flex-1 bg-zinc-900 rounded-full h-3 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        session.averageScore >= 7 ? 'bg-emerald-500/70' :
                                                        session.averageScore >= 5 ? 'bg-amber-500/70' :
                                                        'bg-red-500/70'
                                                    }`}
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                            </div>
                                            <span className="text-zinc-300 w-8 text-right font-mono">{session.averageScore}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Weakest Areas */}
                        {weakest.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-zinc-300 mb-2">🎯 Focus Areas</h3>
                                <div className="space-y-2">
                                    {weakest.map(({ dimension, average }) => (
                                        <div key={dimension} className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-orange-300 capitalize">{dimension}</span>
                                                <span className="text-xs text-orange-400 font-mono">{average}/10</span>
                                            </div>
                                            <p className="text-[10px] text-zinc-400 mt-1">
                                                {dimension === 'completeness' && 'Try covering all aspects of the question. Don\'t skip sub-parts.'}
                                                {dimension === 'structure' && 'Use STAR or a clear framework. Label your sections.'}
                                                {dimension === 'specificity' && 'Add numbers, dates, and concrete examples to your answers.'}
                                                {dimension === 'relevance' && 'Stay focused on what was asked. Avoid tangents.'}
                                                {dimension === 'communication' && 'Practice being concise. Aim for 2-minute answers.'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recent Sessions */}
                        <div>
                            <h3 className="text-xs font-semibold text-zinc-300 mb-2">Recent Sessions</h3>
                            <div className="space-y-1.5">
                                {filteredData.slice(-5).reverse().map(session => {
                                    const date = new Date(session.date).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    });
                                    return (
                                        <div key={session.sessionId} className="flex items-center justify-between bg-zinc-800/30 rounded px-3 py-2 text-xs">
                                            <div>
                                                <span className="text-zinc-300">{session.interviewType}</span>
                                                <span className="text-zinc-500 ml-2">{session.questionCount}q</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-zinc-500">{date}</span>
                                                <span className={`font-mono font-semibold ${
                                                    session.averageScore >= 7 ? 'text-emerald-400' :
                                                    session.averageScore >= 5 ? 'text-amber-400' : 'text-red-400'
                                                }`}>
                                                    {session.averageScore}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
