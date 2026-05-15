export type InterviewType = 
    | 'behavioral'
    | 'technical'
    | 'system-design'
    | 'coding'
    | 'hr-screening'
    | 'case-study'
    | 'general';

export interface PromptContext {
    interviewType: InterviewType;
    currentQuestion: string;
    conversationHistory: string;
    resume?: string;
    jobDescription?: string;
    company?: string;
}

export interface PromptTemplate {
    system: string;
    user: string;
}
