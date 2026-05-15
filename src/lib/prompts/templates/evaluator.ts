import { PromptTemplate, InterviewType } from '../types';

export interface EvaluatorContext {
    interviewType: InterviewType;
    role: string;
    question: string;
    answer: string;
}

export const getEvaluatorPrompt = (context: EvaluatorContext): PromptTemplate => {
    return {
        system: `You are an expert interview coach evaluating a candidate's spoken answer to an interview question.
You must evaluate the answer based on:
1. Completeness
2. Structure (e.g., STAR method for behavioral)
3. Specificity and depth
4. Relevance to the question
5. Conciseness and clarity

IMPORTANT: You MUST respond ONLY with a valid JSON object. Do not include any markdown formatting (like \`\`\`json) or other text.
The JSON must follow this exact structure:
{
  "score": <number between 1 and 10>,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement area 1", "improvement area 2"],
  "modelAnswer": "An example of a great answer to this question..."
}`,
        
        user: `Interview Type: ${context.interviewType}
Role: ${context.role}

Question Asked:
${context.question}

Candidate's Answer:
${context.answer || '[Candidate provided no answer or silence]'}

Evaluate the answer and return the JSON object:`
    };
};
