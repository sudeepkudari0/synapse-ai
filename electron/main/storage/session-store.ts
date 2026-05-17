import { JSONStore } from './store';

export interface ChatBlockData {
    id: string;
    speaker: 'user' | 'interviewer';
    text: string;
    timestamp: Date | string;
}

export interface AnswerData {
    id: string;
    source: 'transcript' | 'screen-capture';
    question: string;
    answer: string;
    timestamp: Date | string;
}

export interface DeliveryMetrics {
    fillerWordCount: number;
    fillerWords: Record<string, number>;
    totalWords: number;
    avgAnswerDuration: number;
    talkTimeRatio: number;
    uniqueWordRatio: number;
    longestPause: number;
}

export interface SessionData {
    id: string;
    startTime: string;
    endTime: string;
    duration: number; // in seconds
    interviewType: string;
    conversation: ChatBlockData[];
    answers: AnswerData[];
    deliveryMetrics?: DeliveryMetrics;
    tags?: string[];
}

export interface SessionSummary {
    id: string;
    startTime: string;
    duration: number;
    interviewType: string;
    questionCount: number;
    tags?: string[];
}

const sessionStore = new JSONStore('sessions');

export const saveSession = (session: SessionData): void => {
    sessionStore.write(`${session.id}.json`, session);
};

export const loadSession = (id: string): SessionData | null => {
    return sessionStore.read<SessionData>(`${id}.json`);
};

export const listSessions = (): SessionSummary[] => {
    const files = sessionStore.list();
    const summaries: SessionSummary[] = [];

    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const session = sessionStore.read<any>(file);
        if (session) {
            // Support both old schema (timestamp/type) and new (startTime/interviewType)
            const startTime = session.startTime || session.timestamp || new Date().toISOString();
            const interviewType = session.interviewType || session.type || 'general';

            // Count questions: use stored questionCount, or count from conversation
            let questionCount = session.questionCount || 0;
            if (questionCount === 0 && session.conversation) {
                questionCount = session.conversation.filter(
                    (b: any) => b.speaker === 'interviewer' && b.text.includes('?')
                ).length;
            }
            if (questionCount === 0 && session.answers) {
                questionCount = session.answers.length;
            }

            summaries.push({
                id: session.id,
                startTime,
                duration: session.duration || 0,
                interviewType,
                questionCount,
                tags: session.tags,
            });
        }
    }

    // Sort by startTime descending (newest first)
    return summaries.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
};

export const deleteSession = (id: string): void => {
    sessionStore.delete(`${id}.json`);
};
