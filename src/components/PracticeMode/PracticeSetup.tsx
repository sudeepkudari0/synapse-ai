import React, { useState } from 'react';
import { usePracticeStore } from '../../state/practice-store';
import { useSessionStore } from '../../state/session-store';
import { InterviewType } from '../../lib/prompts/types';
import { BarChart3 } from 'lucide-react';

interface PracticeSetupProps {
    onShowProgress: () => void;
}

export const PracticeSetup: React.FC<PracticeSetupProps> = ({ onShowProgress }) => {
    const { startPractice } = usePracticeStore();
    const { resetSession } = useSessionStore();
    const [interviewType, setInterviewType] = useState<InterviewType>('behavioral');
    const [role, setRole] = useState('Software Engineer');
    const [company, setCompany] = useState('');
    const [questionCount, setQuestionCount] = useState(5);

    const handleStart = () => {
        resetSession();
        startPractice({
            interviewType,
            role,
            company: company.trim() || undefined,
            questionCount,
        });
    };

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-white">Practice Mode Setup</h2>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Interview Type</label>
                    <select
                        value={interviewType}
                        onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white"
                    >
                        <option value="behavioral">Behavioral</option>
                        <option value="technical">Technical</option>
                        <option value="system-design">System Design</option>
                        <option value="coding">Coding</option>
                        <option value="hr-screening">HR Screening</option>
                        <option value="general">General</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Target Role</label>
                    <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white"
                        placeholder="e.g. Frontend Developer"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Target Company (Optional)</label>
                    <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white"
                        placeholder="e.g. Google"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Number of Questions ({questionCount})</label>
                    <input
                        type="range"
                        min="3"
                        max="10"
                        value={questionCount}
                        onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>

            <div className="pt-4">
                <button
                    onClick={handleStart}
                    disabled={!role.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-50"
                >
                    Start Practice Session
                </button>
                <button
                    onClick={onShowProgress}
                    className="w-full mt-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
                >
                    <BarChart3 className="w-4 h-4" />
                    View Progress
                </button>
            </div>
        </div>
    );
};
