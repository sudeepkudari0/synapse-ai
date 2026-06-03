/**
 * Cover Letter Generator
 * Ported from cv-tailor/src/core/coverLetter.ts
 */

import type { LLMProvider } from './types';
import { PROMPTS } from './prompts';

export class CoverLetterGenerator {
  constructor(private llm: LLMProvider) {}

  async generate(
    company: string,
    jobTitle: string,
    jobDescription: string,
    resumeText: string,
    tone: string = "professional"
  ): Promise<string> {
    const jdSummary = jobDescription.length > 3000
      ? jobDescription.slice(0, 3000)
      : jobDescription;

    const response = await this.llm.generate(
      PROMPTS.cover_letter.user(company, jobTitle, jdSummary, resumeText, tone),
      {
        systemPrompt: PROMPTS.cover_letter.system,
        temperature: 0.2,
      }
    );

    return response.content.trim();
  }
}
