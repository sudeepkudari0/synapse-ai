/**
 * Interview Scenarios — Pre-defined interview question/answer scripts for E2E testing.
 *
 * Each scenario defines a structured interview conversation that the test harness
 * can replay through the app to verify the full pipeline.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface InterviewQuestion {
    id: string;
    text: string;                       // The question text (also what the audio says)
    expectedDetection: boolean;          // Should question detector flag this?
    expectedType: string;                // Expected interview type classification
    expectedConfidence: 'high' | 'medium' | 'low';
    audioFile: string;                   // Relative path in test-data/interview-audio/
}

export interface InterviewResponse {
    id: string;
    text: string;
    audioFile: string;
}

export interface InterviewTurn {
    type: 'question' | 'answer' | 'acknowledgment';
    speaker: 'interviewer' | 'user';
    content: InterviewQuestion | InterviewResponse;
    delayBeforeMs: number;              // Simulated delay before this turn
}

export interface InterviewScenario {
    name: string;
    description: string;
    type: 'behavioral' | 'technical' | 'system-design' | 'coding' | 'general' | 'mixed';
    turns: InterviewTurn[];
}

// ─── Behavioral Interview Scenario ──────────────────────────────────

export const BEHAVIORAL_SCENARIO: InterviewScenario = {
    name: 'Behavioral Interview',
    description: 'Standard behavioral interview with STAR-method questions',
    type: 'behavioral',
    turns: [
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'behavioral-01',
                text: 'Tell me about a time when you had to handle a challenging project deadline. How did you manage it?',
                expectedDetection: true,
                expectedType: 'behavioral',
                expectedConfidence: 'high',
                audioFile: 'interviewer/behavioral-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 0,
        },
        {
            type: 'answer',
            speaker: 'user',
            content: {
                id: 'answer-01',
                text: 'In my previous role at the startup, we had a critical product launch with a two week deadline. I broke the project into smaller milestones and coordinated daily standups with the team.',
                audioFile: 'user/answer-01.wav',
            } as InterviewResponse,
            delayBeforeMs: 2000,
        },
        {
            type: 'acknowledgment',
            speaker: 'interviewer',
            content: {
                id: 'ack-01',
                text: 'Okay, great. That sounds good.',
                expectedDetection: false,
                expectedType: 'general',
                expectedConfidence: 'low',
                audioFile: 'acknowledgments/ack-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1000,
        },
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'behavioral-02',
                text: 'Can you describe a situation where you had to work with a difficult team member?',
                expectedDetection: true,
                expectedType: 'behavioral',
                expectedConfidence: 'high',
                audioFile: 'interviewer/behavioral-02.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1500,
        },
    ],
};

// ─── Technical Interview Scenario ───────────────────────────────────

export const TECHNICAL_SCENARIO: InterviewScenario = {
    name: 'Technical Interview',
    description: 'Technical/DSA focused interview with coding questions',
    type: 'technical',
    turns: [
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'technical-01',
                text: 'What is the difference between a hash map and a binary search tree in terms of time complexity?',
                expectedDetection: true,
                expectedType: 'technical',
                expectedConfidence: 'high',
                audioFile: 'interviewer/technical-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 0,
        },
        {
            type: 'answer',
            speaker: 'user',
            content: {
                id: 'answer-02',
                text: 'I would use a hash map approach. First, I iterate through the array and for each element, I check if the complement exists in the map. This gives us O of n time complexity.',
                audioFile: 'user/answer-02.wav',
            } as InterviewResponse,
            delayBeforeMs: 2000,
        },
        {
            type: 'acknowledgment',
            speaker: 'interviewer',
            content: {
                id: 'ack-02',
                text: 'Right, I see. Interesting.',
                expectedDetection: false,
                expectedType: 'general',
                expectedConfidence: 'low',
                audioFile: 'acknowledgments/ack-02.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1000,
        },
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'technical-02',
                text: 'How would you explain the concept of closures in JavaScript?',
                expectedDetection: true,
                expectedType: 'technical',
                expectedConfidence: 'high',
                audioFile: 'interviewer/technical-02.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1500,
        },
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'coding-01',
                text: 'Given an array of integers, how would you find two numbers that add up to a target sum?',
                expectedDetection: true,
                expectedType: 'coding',
                expectedConfidence: 'high',
                audioFile: 'interviewer/coding-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 2000,
        },
    ],
};

// ─── System Design Scenario ─────────────────────────────────────────

export const SYSTEM_DESIGN_SCENARIO: InterviewScenario = {
    name: 'System Design Interview',
    description: 'System design interview with architecture questions',
    type: 'system-design',
    turns: [
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'system-design-01',
                text: 'How would you design a URL shortening service like bit.ly?',
                expectedDetection: true,
                expectedType: 'system-design',
                expectedConfidence: 'high',
                audioFile: 'interviewer/system-design-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 0,
        },
        {
            type: 'answer',
            speaker: 'user',
            content: {
                id: 'answer-04',
                text: 'For the URL shortener, I would start with a simple architecture. A web server that takes long URLs, generates a unique short code using base 62 encoding, stores the mapping in a database, and redirects when accessed.',
                audioFile: 'user/answer-04.wav',
            } as InterviewResponse,
            delayBeforeMs: 3000,
        },
        {
            type: 'acknowledgment',
            speaker: 'interviewer',
            content: {
                id: 'ack-03',
                text: 'Perfect, thank you for that explanation.',
                expectedDetection: false,
                expectedType: 'general',
                expectedConfidence: 'low',
                audioFile: 'acknowledgments/ack-03.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1500,
        },
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'system-design-02',
                text: 'Walk me through how you would design a real-time chat application at scale.',
                expectedDetection: true,
                expectedType: 'system-design',
                expectedConfidence: 'high',
                audioFile: 'interviewer/system-design-02.wav',
            } as InterviewQuestion,
            delayBeforeMs: 2000,
        },
    ],
};

// ─── Mixed Scenario (Full Interview) ────────────────────────────────

export const FULL_INTERVIEW_SCENARIO: InterviewScenario = {
    name: 'Full Mixed Interview',
    description: 'Complete interview simulation with behavioral, technical, and system design questions',
    type: 'mixed',
    turns: [
        // Opening question
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'general-01',
                text: 'Why are you interested in this position and what draws you to our company?',
                expectedDetection: true,
                expectedType: 'general',
                expectedConfidence: 'high',
                audioFile: 'interviewer/general-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 0,
        },
        {
            type: 'answer',
            speaker: 'user',
            content: {
                id: 'answer-03',
                text: 'I\'m really excited about this role because it combines my passion for distributed systems with the opportunity to work on products that impact millions of users.',
                audioFile: 'user/answer-03.wav',
            } as InterviewResponse,
            delayBeforeMs: 2000,
        },
        // Behavioral
        {
            type: 'acknowledgment',
            speaker: 'interviewer',
            content: {
                id: 'ack-04',
                text: 'Got it. Let\'s move on to the next topic.',
                expectedDetection: false,
                expectedType: 'general',
                expectedConfidence: 'low',
                audioFile: 'acknowledgments/ack-04.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1000,
        },
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'behavioral-01',
                text: 'Tell me about a time when you had to handle a challenging project deadline. How did you manage it?',
                expectedDetection: true,
                expectedType: 'behavioral',
                expectedConfidence: 'high',
                audioFile: 'interviewer/behavioral-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1500,
        },
        {
            type: 'answer',
            speaker: 'user',
            content: {
                id: 'answer-01',
                text: 'In my previous role at the startup, we had a critical product launch with a two week deadline. I broke the project into smaller milestones and coordinated daily standups with the team.',
                audioFile: 'user/answer-01.wav',
            } as InterviewResponse,
            delayBeforeMs: 2000,
        },
        // Technical
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'technical-01',
                text: 'What is the difference between a hash map and a binary search tree in terms of time complexity?',
                expectedDetection: true,
                expectedType: 'technical',
                expectedConfidence: 'high',
                audioFile: 'interviewer/technical-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1500,
        },
        {
            type: 'answer',
            speaker: 'user',
            content: {
                id: 'answer-02',
                text: 'I would use a hash map approach. First, I iterate through the array and for each element, I check if the complement exists in the map. This gives us O of n time complexity.',
                audioFile: 'user/answer-02.wav',
            } as InterviewResponse,
            delayBeforeMs: 3000,
        },
        // System Design
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'system-design-01',
                text: 'How would you design a URL shortening service like bit.ly?',
                expectedDetection: true,
                expectedType: 'system-design',
                expectedConfidence: 'high',
                audioFile: 'interviewer/system-design-01.wav',
            } as InterviewQuestion,
            delayBeforeMs: 2000,
        },
        {
            type: 'answer',
            speaker: 'user',
            content: {
                id: 'answer-04',
                text: 'For the URL shortener, I would start with a simple architecture. A web server that takes long URLs, generates a unique short code using base 62 encoding, stores the mapping in a database, and redirects when accessed.',
                audioFile: 'user/answer-04.wav',
            } as InterviewResponse,
            delayBeforeMs: 3000,
        },
        // Closing
        {
            type: 'question',
            speaker: 'interviewer',
            content: {
                id: 'general-02',
                text: 'Where do you see yourself in five years?',
                expectedDetection: true,
                expectedType: 'general',
                expectedConfidence: 'high',
                audioFile: 'interviewer/general-02.wav',
            } as InterviewQuestion,
            delayBeforeMs: 1500,
        },
    ],
};

// ─── All Scenarios ──────────────────────────────────────────────────

export const ALL_SCENARIOS: InterviewScenario[] = [
    BEHAVIORAL_SCENARIO,
    TECHNICAL_SCENARIO,
    SYSTEM_DESIGN_SCENARIO,
    FULL_INTERVIEW_SCENARIO,
];

/**
 * Get questions only from a scenario (filters out answers and acknowledgments).
 */
export function getQuestionsFromScenario(scenario: InterviewScenario): InterviewQuestion[] {
    return scenario.turns
        .filter(t => t.type === 'question')
        .map(t => t.content as InterviewQuestion);
}

/**
 * Get a flat list of all unique question audio files across all scenarios.
 */
export function getAllQuestionAudioFiles(): string[] {
    const files = new Set<string>();
    for (const scenario of ALL_SCENARIOS) {
        for (const turn of scenario.turns) {
            if (turn.type === 'question') {
                files.add((turn.content as InterviewQuestion).audioFile);
            }
        }
    }
    return Array.from(files);
}
