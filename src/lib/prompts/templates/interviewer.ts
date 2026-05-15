import { PromptTemplate, InterviewType } from '../types';

export interface InterviewerContext {
    interviewType: InterviewType;
    role: string;
    company?: string;
    resume?: string;
    jobDescription?: string;
    previousQuestions: string[];
    difficultyLevel: number; // e.g., 1 to 5
}

export const getInterviewerPrompt = (context: InterviewerContext): PromptTemplate => {
    return {
        system: `You are an expert interviewer at a top-tier company conducting a ${context.interviewType} interview.
Your goal is to generate ONE realistic interview question for a candidate applying for the role of ${context.role}${context.company ? ` at ${context.company}` : ''}.

Guidelines:
- Generate exactly ONE question.
- Do NOT provide the answer or any introductory text. Just the question.
- The question should match a difficulty level of ${context.difficultyLevel} out of 5.
- If resume or job description context is provided, try to make the question highly relevant to their experience or the specific job requirements.
- Ensure the question is not in the list of previously asked questions.`,
        
        user: `Candidate Resume:
${context.resume || 'Not provided.'}

Job Description:
${context.jobDescription || 'Not provided.'}

Previously Asked Questions:
${context.previousQuestions.length > 0 ? context.previousQuestions.join('\n') : 'None'}

Please ask the next question:`
    };
};
