import { create } from 'zustand';

interface UIState {
    // State
    isExpanded: boolean;
    isSettingsOpen: boolean;
    isChatOpen: boolean;
    isCapturing: boolean;

    // Actions
    toggleExpanded: () => void;
    setExpanded: (expanded: boolean) => void;
    toggleSettings: () => void;
    setSettingsOpen: (open: boolean) => void;
    toggleChat: () => void;
    setChatOpen: (open: boolean) => void;
    setCapturing: (capturing: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
    // Initial state
    isExpanded: false,
    isSettingsOpen: false,
    isChatOpen: false,
    isCapturing: false,

    // Actions
    toggleExpanded: () =>
        set((state) => {
            const willCollapse = state.isExpanded;
            return {
                isExpanded: !state.isExpanded,
                // Close settings and chat when collapsing
                ...(willCollapse ? { isSettingsOpen: false, isChatOpen: false } : {}),
            };
        }),

    setExpanded: (expanded) => set({ isExpanded: expanded }),

    toggleSettings: () =>
        set((state) => {
            const willBeOpen = !state.isSettingsOpen;
            return {
                isSettingsOpen: willBeOpen,
                // Close chat when opening settings, expand widget if needed
                ...(willBeOpen
                    ? { isChatOpen: false, isExpanded: true }
                    : {}),
            };
        }),

    setSettingsOpen: (open) => set({ isSettingsOpen: open }),

    toggleChat: () =>
        set((state) => {
            const willBeOpen = !state.isChatOpen;
            return {
                isChatOpen: willBeOpen,
                // Close settings when opening chat, expand widget if needed
                ...(willBeOpen
                    ? { isSettingsOpen: false, isExpanded: true }
                    : {}),
            };
        }),

    setChatOpen: (open) => set({ isChatOpen: open }),

    setCapturing: (capturing) => set({ isCapturing: capturing }),
}));
