import { useState, useEffect, useRef } from 'react';
import { CheckCircle } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';

export function ProfileSection() {
    const { profile, isProfileLoaded, saveProfile } = useProfile();
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [localProfile, setLocalProfile] = useState({
        resume: '',
        jobDescription: '',
        targetCompany: '',
        targetRole: '',
        skills: ''
    });
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInitialLoadRef = useRef(true);

    // Sync local state when profile is loaded
    useEffect(() => {
        if (isProfileLoaded) {
            setLocalProfile({
                resume: profile.resume || '',
                jobDescription: profile.jobDescription || '',
                targetCompany: profile.targetCompany || '',
                targetRole: profile.targetRole || '',
                skills: profile.skills ? profile.skills.join(', ') : ''
            });
            // Mark initial load complete after state sync
            setTimeout(() => { isInitialLoadRef.current = false; }, 100);
        }
    }, [isProfileLoaded, profile]);

    // Auto-save profile on change (debounced 1s)
    useEffect(() => {
        if (isInitialLoadRef.current) return;

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(() => {
            doSave();
        }, 1000);

        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [localProfile]);

    const doSave = async () => {
        const updates = {
            ...localProfile,
            skills: localProfile.skills.split(',').map(s => s.trim()).filter(s => s.length > 0)
        };

        const success = await saveProfile(updates);

        if (success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    return (
        <div className="space-y-4 pr-2 custom-scrollbar">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-white">Candidate Profile</h3>
                <div className="flex items-center gap-2">
                    {saveSuccess && (
                        <span className="flex items-center text-[10px] text-emerald-400 animate-fade-in">
                            <CheckCircle className="w-3 h-3 mr-0.5" /> Saved
                        </span>
                    )}
                    {isProfileLoaded ? (
                        <span className="flex items-center text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                            <CheckCircle className="w-3 h-3 mr-1" /> Profile Loaded
                        </span>
                    ) : (
                        <span className="text-xs text-zinc-500">No profile set</span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Target Company</label>
                    <input
                        type="text"
                        value={localProfile.targetCompany}
                        onChange={(e) => setLocalProfile({ ...localProfile, targetCompany: e.target.value })}
                        placeholder="e.g. Google"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Target Role</label>
                    <input
                        type="text"
                        value={localProfile.targetRole}
                        onChange={(e) => setLocalProfile({ ...localProfile, targetRole: e.target.value })}
                        placeholder="e.g. Senior Frontend Engineer"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Core Skills (comma separated)</label>
                <input
                    type="text"
                    value={localProfile.skills}
                    onChange={(e) => setLocalProfile({ ...localProfile, skills: e.target.value })}
                    placeholder="React, TypeScript, System Design..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Resume (Plain Text / Markdown)</label>
                <textarea
                    value={localProfile.resume}
                    onChange={(e) => setLocalProfile({ ...localProfile, resume: e.target.value })}
                    placeholder="Paste your resume content here..."
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Job Description</label>
                <textarea
                    value={localProfile.jobDescription}
                    onChange={(e) => setLocalProfile({ ...localProfile, jobDescription: e.target.value })}
                    placeholder="Paste the job description here..."
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
            </div>
            
            <p className="text-[10px] text-zinc-500 mt-2 text-center">
                Profile auto-saves as you type. Your data stays 100% local on your machine.
            </p>
        </div>
    );
}
