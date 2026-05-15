import { create } from 'zustand';

interface UIState {
    // State
    isExpanded: boolean;
    isSettingsOpen: boolean;
    isChatOpen: boolean;
    isHistoryOpen: boolean;
    isCapturing: boolean;

    // Actions
    toggleExpanded: () => void;
    setExpanded: (expanded: boolean) => void;
    toggleSettings: () => void;
    setSettingsOpen: (open: boolean) => void;
    toggleChat: () => void;
    setChatOpen: (open: boolean) => void;
    toggleHistory: () => void;
    setHistoryOpen: (open: boolean) => void;
    setCapturing: (capturing: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
    // Initial state
    isExpanded: false,
    isSettingsOpen: false,
    isChatOpen: false,
    isHistoryOpen: false,
    isCapturing: false,

    // Actions
    toggleExpanded: () =>
        set((state) => {
            const willCollapse = state.isExpanded;
            return {
                isExpanded: !state.isExpanded,
                // Close settings, chat and history when collapsing
                ...(willCollapse ? { isSettingsOpen: false, isChatOpen: false, isHistoryOpen: false } : {}),
            };
        }),

    setExpanded: (expanded) => set({ isExpanded: expanded }),

    toggleSettings: () =>
        set((state) => {
            const willBeOpen = !state.isSettingsOpen;
            return {
                isSettingsOpen: willBeOpen,
                // Close chat and history when opening settings, expand widget if needed
                ...(willBeOpen
                    ? { isChatOpen: false, isHistoryOpen: false, isExpanded: true }
                    : {}),
            };
        }),

    setSettingsOpen: (open) => set({ isSettingsOpen: open }),

    toggleChat: () =>
        set((state) => {
            const willBeOpen = !state.isChatOpen;
            return {
                isChatOpen: willBeOpen,
                // Close settings and history when opening chat, expand widget if needed
                ...(willBeOpen
                    ? { isSettingsOpen: false, isHistoryOpen: false, isExpanded: true }
                    : {}),
            };
        }),

    setChatOpen: (open) => set({ isChatOpen: open }),

    toggleHistory: () =>
        set((state) => {
            const willBeOpen = !state.isHistoryOpen;
            return {
                isHistoryOpen: willBeOpen,
                // Close settings and chat when opening history, expand widget if needed
                ...(willBeOpen
                    ? { isSettingsOpen: false, isChatOpen: false, isExpanded: true }
                    : {}),
            };
        }),

    setHistoryOpen: (open) => set({ isHistoryOpen: open }),

    setCapturing: (capturing) => set({ isCapturing: capturing }),
}));
