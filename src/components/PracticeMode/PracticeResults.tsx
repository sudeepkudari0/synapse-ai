import React, { useEffect, useRef } from 'react';
import { usePracticeStore } from '../../state/practice-store';

export const PracticeResults: React.FC = () => {
    const { evaluations, practiceConfig, practiceQuestions, resetPractice } = usePracticeStore();
    const hasSavedRef = useRef(false);

    useEffect(() => {
        if (!practiceConfig || evaluations.length === 0 || hasSavedRef.current) return;

        const saveSession = async () => {
            hasSavedRef.current = true;
            
            const answersData = practiceQuestions.map(q => {
                const evalData = evaluations.find(e => e.questionId === q.id);
                const scoreText = evalData 
                    ? `\n\n**Evaluation Score:** ${evalData.score}/10\n**Strengths:**\n- ${evalData.strengths.join('\n- ')}\n\n**Areas for Improvement:**\n- ${evalData.improvements.join('\n- ')}\n\n**Model Answer:**\n${evalData.modelAnswer}` 
                    : '';
                
                return {
                    id: q.id,
                    source: 'transcript' as const,
                    question: q.question,
                    answer: (q.answer || 'No answer recorded.') + scoreText,
                    timestamp: new Date().toISOString()
                };
            });

            const sessionData = {
                id: Date.now().toString(),
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: 0, // Optional tracking
                interviewType: practiceConfig.interviewType,
                conversation: [], // Keep empty for practice mode, relying on answers
                answers: answersData,
                tags: ['practice', practiceConfig.role]
            };

            try {
                await window.electronAPI.session.save(sessionData);
            } catch (err) {
                console.error("Failed to save practice session:", err);
            }
        };

        saveSession();
    }, [practiceConfig, practiceQuestions, evaluations]);

    if (!practiceConfig) return null;

    const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
    const avgScore = evaluations.length > 0 ? (totalScore / evaluations.length).toFixed(1) : 0;

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white overflow-y-auto p-4">
            <h2 className="text-2xl font-bold mb-6 text-center">Practice Complete!</h2>

            <div className="bg-slate-800 rounded-lg p-6 text-center border border-slate-700 mb-6">
                <div className="text-5xl font-bold text-blue-400 mb-2">{avgScore}/10</div>
                <div className="text-slate-400 text-sm">Average Score</div>
                <div className="mt-4 text-sm text-slate-300">
                    Role: <span className="font-medium text-white">{practiceConfig.role}</span> | Type: <span className="font-medium text-white">{practiceConfig.interviewType}</span>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-xl font-semibold border-b border-slate-700 pb-2">Question Breakdown</h3>
                
                {practiceQuestions.map((q, index) => {
                    const evalData = evaluations.find(e => e.questionId === q.id);
                    if (!evalData) return null;

                    return (
                        <div key={q.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="bg-slate-700 px-4 py-3 border-b border-slate-600 flex justify-between items-start">
                                <div className="flex-1 pr-4">
                                    <span className="text-xs font-bold text-slate-400 mb-1 block">Q{index + 1}</span>
                                    <h4 className="font-medium text-white text-sm">{q.question}</h4>
                                </div>
                                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded shrink-0 mt-1">
                                    {evalData.score}/10
                                </span>
                            </div>
                            
                            <div className="p-4 space-y-3 text-sm">
                                <div>
                                    <h5 className="text-slate-400 text-xs font-semibold uppercase mb-1">Your Answer</h5>
                                    <p className="text-slate-300 italic">{q.answer || "No answer recorded."}</p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-700/50">
                                    <div>
                                        <h5 className="text-emerald-400 font-medium mb-1 flex items-center">
                                            <span className="mr-1">✓</span> Strengths
                                        </h5>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-300 text-xs">
                                            {evalData.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h5 className="text-orange-400 font-medium mb-1 flex items-center">
                                            <span className="mr-1">△</span> Improvements
                                        </h5>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-300 text-xs">
                                            {evalData.improvements.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-4 pb-4">
                <button
                    onClick={resetPractice}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-slate-600"
                >
                    Start New Practice
                </button>
            </div>
        </div>
    );
};
