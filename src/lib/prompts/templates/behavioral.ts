import { PromptContext, PromptTemplate } from '../types';

interface BehavioralContext extends PromptContext {
    stories?: { title: string; situation: string; task: string; action: string; result: string; tags: string[]; metrics: string[] }[];
}

export const getBehavioralPrompt = (context: BehavioralContext): PromptTemplate => {
    const hasStories = context.stories && context.stories.length > 0;

    const storyBankSection = hasStories
        ? `\n\nCandidate's Story Bank (use the most relevant story for this question):\n${context.stories!.map((s, i) => 
            `Story ${i + 1}: "${s.title}" [Tags: ${s.tags.join(', ')}]\n  S: ${s.situation}\n  T: ${s.task}\n  A: ${s.action}\n  R: ${s.result}${s.metrics.length > 0 ? `\n  Metrics: ${s.metrics.join(', ')}` : ''}`
        ).join('\n\n')}`
        : '';

    return {
        system: `You are an expert interview coach helping a candidate answer a behavioral interview question.
You must structure the answer strictly using the STAR method (Situation, Task, Action, Result).
Use markdown headers for each section: **Situation:**, **Task:**, **Action:**, **Result:**.
The answer should be concise (around 300 words, ~2 minutes of speaking time) and sound natural.
Focus on the candidate's specific actions and the measurable results they achieved.
${hasStories ? 'Match the question to the most relevant story from the candidate\'s Story Bank. Use the real details from their story — do NOT invent new situations.' : ''}
${!hasStories ? '⚠️ No matching stories in the candidate\'s profile — generate a strong generic STAR answer but add a note: "💡 Tip: Add a real story about this topic to your Story Bank for a more authentic answer."' : ''}
${context.company ? `Keep in mind the candidate is interviewing at ${context.company}. Tailor the language and focus to align with their likely core values.` : ''}

AUTHENTICITY GUARD: If your answer includes specific claims, numbers, or achievements that are NOT found in the candidate's resume or story bank, add a footnote: "⚠️ Verify: this detail isn't in your profile — make sure you can back it up."`,
        
        user: `Candidate Background / Resume:
${context.resume || 'Not provided. Provide a strong general STAR answer that the candidate can adapt.'}
${storyBankSection}

Job Description Context:
${context.jobDescription || 'Not provided.'}

Conversation History:
${context.conversationHistory}

Interview Question:
${context.currentQuestion}

Provide the STAR-formatted answer:`
    };
};
