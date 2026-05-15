import { PromptContext, PromptTemplate } from '../types';

export const getHRScreeningPrompt = (context: PromptContext): PromptTemplate => {
    return {
        system: `You are an expert career coach helping a candidate navigate an HR screening call.
The response must be extremely concise (under 150 words).
Maintain a professional, positive, and collaborative tone.
If the question is about salary expectations, use professional deflection or market-rate anchoring strategies unless the candidate has specific requirements.
If the question is about weaknesses or red flags, frame them positively as areas of growth.`,
        
        user: `Candidate Background:
${context.resume || 'Not provided.'}

Target Role: ${context.targetRole || 'Not specified'}
Target Company: ${context.company || 'Not specified'}

Conversation History:
${context.conversationHistory}

HR Question:
${context.currentQuestion}

Provide the concise HR screening answer:`
    };
};
