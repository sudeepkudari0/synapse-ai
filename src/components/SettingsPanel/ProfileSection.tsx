import { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';

export function ProfileSection() {
    const { profile, isProfileLoaded, saveProfile } = useProfile();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [localProfile, setLocalProfile] = useState({
        resume: '',
        jobDescription: '',
        targetCompany: '',
        targetRole: '',
        skills: ''
    });

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
        }
    }, [isProfileLoaded, profile]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        const updates = {
            ...localProfile,
            skills: localProfile.skills.split(',').map(s => s.trim()).filter(s => s.length > 0)
        };

        const success = await saveProfile(updates);
        
        setIsSaving(false);
        if (success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        }
    };

    return (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-white">Candidate Profile</h3>
                {isProfileLoaded ? (
                    <span className="flex items-center text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                        <CheckCircle className="w-3 h-3 mr-1" /> Profile Loaded
                    </span>
                ) : (
                    <span className="text-xs text-zinc-500">No profile set</span>
                )}
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

            <div className="pt-2 flex justify-end items-center">
                {saveSuccess && <span className="text-xs text-emerald-400 mr-3">Saved successfully!</span>}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors border border-zinc-700 disabled:opacity-50"
                >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
            </div>
            
            <p className="text-[10px] text-zinc-500 mt-2 text-center">
                This profile data stays 100% local on your machine. It is injected into LLM prompts to provide personalized answers.
            </p>
        </div>
    );
}
