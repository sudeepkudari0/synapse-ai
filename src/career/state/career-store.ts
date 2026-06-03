/**
 * Career Hub Zustand Store
 * Manages jobs, career profile, and UI state for the Career Hub module.
 */

import { create } from 'zustand';
import type { Job, JobStatus, MasterResume, JDAnalysis, CareerProfile } from '../core/types';

// ─── Job Store ─────────────────────────────────────────────────────────────

interface JobStore {
  jobs: Job[];
  selectedJobId: string | null;
  searchQuery: string;
  statusFilter: JobStatus | 'all';

  // Actions
  setJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  setSelectedJob: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: JobStatus | 'all') => void;
  getFilteredJobs: () => Job[];
  getJobsByStatus: (status: JobStatus) => Job[];
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  selectedJobId: null,
  searchQuery: '',
  statusFilter: 'all',

  setJobs: (jobs) => set({ jobs }),
  addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
  updateJob: (id, updates) => set((state) => ({
    jobs: state.jobs.map((j) =>
      j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j
    ),
  })),
  removeJob: (id) => set((state) => ({
    jobs: state.jobs.filter((j) => j.id !== id),
    selectedJobId: state.selectedJobId === id ? null : state.selectedJobId,
  })),
  setSelectedJob: (id) => set({ selectedJobId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),

  getFilteredJobs: () => {
    const { jobs, searchQuery, statusFilter } = get();
    let filtered = jobs;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((j) => j.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        (j.description || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  },

  getJobsByStatus: (status) => {
    return get().jobs.filter((j) => j.status === status);
  },
}));

// ─── Tailoring Store ───────────────────────────────────────────────────────

interface TailoringStore {
  masterResume: MasterResume | null;
  masterResumeYaml: string;
  masterResumeText: string;
  tailoredResume: string;
  coverLetter: string;
  jdAnalysis: JDAnalysis | null;
  isGenerating: boolean;
  generatingStatus: string;
  error: string | null;

  setMasterResume: (resume: MasterResume | null) => void;
  setMasterResumeYaml: (yaml: string) => void;
  setMasterResumeText: (text: string) => void;
  setTailoredResume: (resume: string) => void;
  setCoverLetter: (letter: string) => void;
  setJdAnalysis: (analysis: JDAnalysis | null) => void;
  setIsGenerating: (v: boolean) => void;
  setGeneratingStatus: (status: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTailoringStore = create<TailoringStore>((set) => ({
  masterResume: null,
  masterResumeYaml: '',
  masterResumeText: '',
  tailoredResume: '',
  coverLetter: '',
  jdAnalysis: null,
  isGenerating: false,
  generatingStatus: '',
  error: null,

  setMasterResume: (resume) => set({ masterResume: resume }),
  setMasterResumeYaml: (yaml) => set({ masterResumeYaml: yaml }),
  setMasterResumeText: (text) => set({ masterResumeText: text }),
  setTailoredResume: (resume) => set({ tailoredResume: resume }),
  setCoverLetter: (letter) => set({ coverLetter: letter }),
  setJdAnalysis: (analysis) => set({ jdAnalysis: analysis }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setGeneratingStatus: (status) => set({ generatingStatus: status }),
  setError: (error) => set({ error }),
  reset: () => set({
    tailoredResume: '',
    coverLetter: '',
    jdAnalysis: null,
    isGenerating: false,
    generatingStatus: '',
    error: null,
  }),
}));

// ─── Career Profile Store ──────────────────────────────────────────────────

interface CareerProfileStore {
  profile: CareerProfile | null;
  setProfile: (profile: CareerProfile) => void;
}

export const useCareerProfileStore = create<CareerProfileStore>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
