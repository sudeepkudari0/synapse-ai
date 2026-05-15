import { create } from 'zustand';
import { InterviewType } from '../lib/prompts/types';

export interface PracticeConfig {
    interviewType: InterviewType;
    role: string;
    company?: string;
    questionCount: number; // 5-10
}

export interface PracticeQuestion {
    id: string;
    question: string;
    answer?: string; // the transcribed user's answer
}

export interface PracticeEvaluation {
    questionId: string;
    score: number;
    strengths: string[];
    improvements: string[];
    modelAnswer: string;
}

interface PracticeState {
    // State
    isPracticeMode: boolean;
    practiceConfig: PracticeConfig | null;
    currentQuestionIndex: number;
    practiceQuestions: PracticeQuestion[];
    evaluations: PracticeEvaluation[];

    // Actions
    startPractice: (config: PracticeConfig) => void;
    endPractice: () => void;
    setPracticeQuestions: (questions: PracticeQuestion[]) => void;
    setCurrentQuestionIndex: (index: number) => void;
    nextQuestion: () => void;
    addEvaluation: (evaluation: PracticeEvaluation) => void;
    updateQuestionAnswer: (questionId: string, answer: string) => void;
    resetPractice: () => void;
}

export const usePracticeStore = create<PracticeState>((set) => ({
    // Initial state
    isPracticeMode: false,
    practiceConfig: null,
    currentQuestionIndex: 0,
    practiceQuestions: [],
    evaluations: [],

    // Actions
    startPractice: (config) =>
        set({
            isPracticeMode: true,
            practiceConfig: config,
            currentQuestionIndex: 0,
            practiceQuestions: [],
            evaluations: [],
        }),

    endPractice: () =>
        set({
            // Keep isPracticeMode true so PracticeResults renders
            // resetPractice() handles full teardown back to setup
        }),

    setPracticeQuestions: (questions) =>
        set({ practiceQuestions: questions }),

    setCurrentQuestionIndex: (index) =>
        set({ currentQuestionIndex: index }),

    nextQuestion: () =>
        set((state) => ({
            currentQuestionIndex: Math.min(
                state.currentQuestionIndex + 1,
                state.practiceQuestions.length - 1
            ),
        })),

    addEvaluation: (evaluation) =>
        set((state) => ({
            evaluations: [...state.evaluations, evaluation],
        })),

    updateQuestionAnswer: (questionId, answer) =>
        set((state) => ({
            practiceQuestions: state.practiceQuestions.map((q) =>
                q.id === questionId ? { ...q, answer } : q
            ),
        })),

    resetPractice: () =>
        set({
            isPracticeMode: false,
            practiceConfig: null,
            currentQuestionIndex: 0,
            practiceQuestions: [],
            evaluations: [],
        }),
}));
