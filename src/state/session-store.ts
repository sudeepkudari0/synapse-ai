import { create } from 'zustand';
import { SpeakerSource } from '../hooks/useMixedAudioRecorder';

export interface ChatBlock {
    id: string;
    speaker: SpeakerSource;
    text: string;
    timestamp: Date;
}

interface SessionState {
    // State
    conversation: ChatBlock[];
    isRecording: boolean;
    sessionTime: number;

    // Actions
    setConversation: (updater: ChatBlock[] | ((prev: ChatBlock[]) => ChatBlock[])) => void;
    addChatBlock: (block: ChatBlock) => void;
    updateLastBlock: (text: string) => void;
    setIsRecording: (recording: boolean) => void;
    setSessionTime: (updater: number | ((prev: number) => number)) => void;
    clearTranscript: () => void;
    resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
    // Initial state
    conversation: [],
    isRecording: false,
    sessionTime: 0,

    // Actions
    setConversation: (updater) =>
        set((state) => ({
            conversation: typeof updater === 'function' ? updater(state.conversation) : updater,
        })),

    addChatBlock: (block) =>
        set((state) => ({
            conversation: [...state.conversation, block],
        })),

    updateLastBlock: (text) =>
        set((state) => {
            const newConv = [...state.conversation];
            if (newConv.length > 0) {
                newConv[newConv.length - 1] = {
                    ...newConv[newConv.length - 1],
                    text,
                };
            }
            return { conversation: newConv };
        }),

    setIsRecording: (recording) => set({ isRecording: recording }),

    setSessionTime: (updater) =>
        set((state) => ({
            sessionTime: typeof updater === 'function' ? updater(state.sessionTime) : updater,
        })),

    clearTranscript: () => set({ conversation: [] }),

    resetSession: () =>
        set({
            conversation: [],
            sessionTime: 0,
        }),
}));
