import { create } from 'zustand';

export interface Answer {
    id: string;
    source: 'transcript' | 'screen-capture';
    question: string;
    answer: string;
    timestamp: Date;
    isStreaming?: boolean;
}

interface AnswerState {
    // State
    answers: Answer[];
    currentAnswerIndex: number;
    isGenerating: boolean;

    // Actions
    addAnswer: (answer: Answer) => void;
    updateAnswer: (id: string, updates: Partial<Answer>) => void;
    removeAnswer: (id: string) => void;
    navigateAnswer: (index: number) => void;
    clearAnswers: () => void;
    setIsGenerating: (generating: boolean) => void;
}

export const useAnswerStore = create<AnswerState>((set, get) => ({
    // Initial state
    answers: [],
    currentAnswerIndex: 0,
    isGenerating: false,

    // Actions
    addAnswer: (answer) =>
        set((state) => ({
            answers: [...state.answers, answer],
            currentAnswerIndex: state.answers.length, // Point to the newly added answer
        })),

    updateAnswer: (id, updates) =>
        set((state) => ({
            answers: state.answers.map((a) =>
                a.id === id ? { ...a, ...updates } : a
            ),
        })),

    removeAnswer: (id) =>
        set((state) => {
            const filtered = state.answers.filter((a) => a.id !== id);
            return {
                answers: filtered,
                currentAnswerIndex: Math.min(
                    state.currentAnswerIndex,
                    Math.max(0, filtered.length - 1)
                ),
            };
        }),

    navigateAnswer: (index) =>
        set((state) => ({
            currentAnswerIndex: Math.max(0, Math.min(index, state.answers.length - 1)),
        })),

    clearAnswers: () =>
        set({
            answers: [],
            currentAnswerIndex: 0,
        }),

    setIsGenerating: (generating) => set({ isGenerating: generating }),
}));
