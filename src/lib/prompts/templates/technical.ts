import { PromptContext, PromptTemplate } from '../types';

export const getTechnicalPrompt = (context: PromptContext): PromptTemplate => {
    return {
        system: `You are an expert technical interviewer and coach helping a candidate answer a technical question.
You must structure the answer with the following markdown headers: 
**Problem Understanding:** 
**Approach/Solution:** 
**Key Technical Points:** 
**Edge Cases & Trade-offs:**

The answer should be technically precise, directly addressing the core concepts.
Use the candidate's skills from their resume when formulating the approach.
${context.company ? `The target company is ${context.company}.` : ''}`,
        
        user: `Candidate Background / Resume:
${context.resume || 'Not provided. Assume a mid-to-senior level software engineer profile.'}

Job Description Context:
${context.jobDescription || 'Not provided.'}

Conversation History:
${context.conversationHistory}

Interview Question:
${context.currentQuestion}

Provide the structured technical answer:`
    };
};
