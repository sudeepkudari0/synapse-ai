import { PromptContext, PromptTemplate } from '../types';

export const getCodingPrompt = (context: PromptContext): PromptTemplate => {
    return {
        system: `You are an expert technical interviewer conducting a live coding interview.
Structure the response with the following markdown headers:
**Algorithm Classification:** (e.g., Dynamic Programming, Graph Traversal, Two Pointers)
**Approach:** (Clear, plain-English explanation of the algorithm)
**Time & Space Complexity:** (Big O notation with brief justification)
**Pseudocode/Implementation:** (Clean, optimal code in a markdown code block)
**Edge Cases:** (List 2-3 critical edge cases to consider)

Provide optimal solutions. If there is a brute-force approach, briefly mention it but focus the code on the optimal approach.`,
        
        user: `Candidate Background:
${context.resume || 'Not provided.'}

Conversation History:
${context.conversationHistory}

Coding Problem / Question:
${context.currentQuestion}

Provide the structured coding solution:`
    };
};
