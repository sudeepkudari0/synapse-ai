import React, { useState } from 'react';
import { useProfileStore, type Story } from '../../state/profile-store';
import { useLLM } from '../../hooks/useLLM';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, Tag, Sparkles, Loader2 } from 'lucide-react';

const STORY_TAGS = ['leadership', 'conflict', 'failure', 'teamwork', 'innovation', 'initiative', 'growth', 'technical', 'customer', 'deadline'];

interface StoryFormData {
    title: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    tags: string[];
    metrics: string[];
}

const emptyForm: StoryFormData = {
    title: '', situation: '', task: '', action: '', result: '', tags: [], metrics: [],
};

export const StoryBank: React.FC = () => {
    const { profile, updateProfile } = useProfileStore();
    const { generateFromPromptTemplate } = useLLM();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<StoryFormData>(emptyForm);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [metricsInput, setMetricsInput] = useState('');

    const stories = profile.stories || [];

    const handleSave = () => {
        const newStory: Story = {
            id: editingId || Date.now().toString(),
            ...form,
        };

        if (editingId) {
            updateProfile({ stories: stories.map(s => s.id === editingId ? newStory : s) });
        } else {
            updateProfile({ stories: [...stories, newStory] });
        }

        setForm(emptyForm);
        setIsAdding(false);
        setEditingId(null);
    };

    const handleEdit = (story: Story) => {
        setForm({
            title: story.title,
            situation: story.situation,
            task: story.task,
            action: story.action,
            result: story.result,
            tags: story.tags,
            metrics: story.metrics,
        });
        setEditingId(story.id);
        setIsAdding(true);
    };

    const handleDelete = (id: string) => {
        updateProfile({ stories: stories.filter(s => s.id !== id) });
    };

    const toggleTag = (tag: string) => {
        setForm(prev => ({
            ...prev,
            tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
        }));
    };

    const addMetric = () => {
        if (metricsInput.trim()) {
            setForm(prev => ({ ...prev, metrics: [...prev.metrics, metricsInput.trim()] }));
            setMetricsInput('');
        }
    };

    const removeMetric = (index: number) => {
        setForm(prev => ({ ...prev, metrics: prev.metrics.filter((_, i) => i !== index) }));
    };

    const handleAutoGenerate = async () => {
        if (!profile.resume) return;
        setIsGenerating(true);
        try {
            const prompt = {
                system: `You are a career coach. Extract 3-5 potential STAR stories from the candidate's resume.
For each story, provide:
- title: A short descriptive title
- situation: The context/background
- task: What was the candidate's responsibility
- action: What specific actions they took
- result: The outcome with metrics if available
- tags: Relevant tags from: ${STORY_TAGS.join(', ')}
- metrics: Any quantifiable achievements

Return as a JSON array of objects with these exact fields.`,
                user: `Extract STAR stories from this resume:\n\n${profile.resume}`,
            };

            const response = await generateFromPromptTemplate(prompt, undefined, 'json');
            const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
            const generated = JSON.parse(cleaned);

            if (Array.isArray(generated)) {
                const newStories: Story[] = generated.map((s: any, i: number) => ({
                    id: `auto-${Date.now()}-${i}`,
                    title: s.title || `Story ${i + 1}`,
                    situation: s.situation || '',
                    task: s.task || '',
                    action: s.action || '',
                    result: s.result || '',
                    tags: Array.isArray(s.tags) ? s.tags : [],
                    metrics: Array.isArray(s.metrics) ? s.metrics : [],
                }));
                updateProfile({ stories: [...stories, ...newStories] });
            }
        } catch (err) {
            console.error('Failed to auto-generate stories:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Story Bank ({stories.length})</h3>
                <div className="flex items-center gap-2">
                    {profile.resume && (
                        <button
                            onClick={handleAutoGenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Auto-generate
                        </button>
                    )}
                    <button
                        onClick={() => { setIsAdding(true); setForm(emptyForm); setEditingId(null); }}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    >
                        <Plus className="w-3 h-3" /> Add Story
                    </button>
                </div>
            </div>

            {/* Story Form */}
            {isAdding && (
                <div className="bg-zinc-800/80 rounded-lg p-3 border border-zinc-700 space-y-3">
                    <input
                        value={form.title}
                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Story Title (e.g., Led cross-team migration)"
                        className="w-full bg-zinc-900 text-white text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 outline-none"
                    />

                    {['situation', 'task', 'action', 'result'].map(field => (
                        <div key={field}>
                            <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1 block">
                                {field.charAt(0).toUpperCase() + field.slice(1)}
                            </label>
                            <textarea
                                value={(form as any)[field]}
                                onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                                placeholder={`Describe the ${field}...`}
                                rows={2}
                                className="w-full bg-zinc-900 text-white text-xs rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 outline-none resize-none"
                            />
                        </div>
                    ))}

                    {/* Tags */}
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1 block">Tags</label>
                        <div className="flex flex-wrap gap-1.5">
                            {STORY_TAGS.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                                        form.tags.includes(tag)
                                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                                            : 'bg-zinc-700 text-zinc-400 border border-transparent hover:text-zinc-200'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Metrics */}
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1 block">Metrics</label>
                        <div className="flex gap-2">
                            <input
                                value={metricsInput}
                                onChange={e => setMetricsInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addMetric()}
                                placeholder="e.g., 20% revenue increase"
                                className="flex-1 bg-zinc-900 text-white text-xs rounded px-3 py-1.5 border border-zinc-700 focus:border-blue-500 outline-none"
                            />
                            <button onClick={addMetric} className="text-xs text-emerald-400 hover:text-emerald-300">Add</button>
                        </div>
                        {form.metrics.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {form.metrics.map((m, i) => (
                                    <span key={i} className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        {m}
                                        <button onClick={() => removeMetric(i)} className="hover:text-red-400">&times;</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button onClick={handleSave} disabled={!form.title} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded transition-colors disabled:opacity-50">
                            {editingId ? 'Update' : 'Save'} Story
                        </button>
                        <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-xs text-zinc-400 hover:text-white px-4 py-1.5 rounded transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Story List */}
            {stories.length === 0 && !isAdding ? (
                <p className="text-xs text-zinc-500 italic">No stories yet. Add career stories for better behavioral answers.</p>
            ) : (
                <div className="space-y-2">
                    {stories.map(story => (
                        <div key={story.id} className="bg-zinc-800/50 rounded-lg border border-zinc-700/50 overflow-hidden">
                            <button
                                onClick={() => setExpandedId(expandedId === story.id ? null : story.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-700/30 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {expandedId === story.id ? <ChevronDown className="w-3 h-3 text-zinc-400" /> : <ChevronRight className="w-3 h-3 text-zinc-400" />}
                                    <span className="text-sm font-medium text-white">{story.title}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {story.tags.slice(0, 3).map(tag => (
                                        <span key={tag} className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">{tag}</span>
                                    ))}
                                </div>
                            </button>

                            {expandedId === story.id && (
                                <div className="px-3 pb-3 space-y-2 text-xs text-zinc-300 border-t border-zinc-700/50 pt-2">
                                    <div><span className="text-blue-400 font-medium">S:</span> {story.situation}</div>
                                    <div><span className="text-emerald-400 font-medium">T:</span> {story.task}</div>
                                    <div><span className="text-amber-400 font-medium">A:</span> {story.action}</div>
                                    <div><span className="text-purple-400 font-medium">R:</span> {story.result}</div>
                                    {story.metrics.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {story.metrics.map((m, i) => (
                                                <span key={i} className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">{m}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={() => handleEdit(story)} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                            <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                        <button onClick={() => handleDelete(story.id)} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
