import { PromptContext, PromptTemplate } from '../types';

export const getBehavioralPrompt = (context: PromptContext): PromptTemplate => {
    return {
        system: `You are an expert interview coach helping a candidate answer a behavioral interview question.
You must structure the answer strictly using the STAR method (Situation, Task, Action, Result).
Use markdown headers for each section: **Situation:**, **Task:**, **Action:**, **Result:**.
The answer should be concise (around 300 words, ~2 minutes of speaking time) and sound natural.
Focus on the candidate's specific actions and the measurable results they achieved.
${context.company ? `Keep in mind the candidate is interviewing at ${context.company}. Tailor the language and focus to align with their likely core values.` : ''}`,
        
        user: `Candidate Background / Resume:
${context.resume || 'Not provided. Provide a strong general STAR answer that the candidate can adapt.'}

Job Description Context:
${context.jobDescription || 'Not provided.'}

Conversation History:
${context.conversationHistory}

Interview Question:
${context.currentQuestion}

Provide the STAR-formatted answer:`
    };
};
