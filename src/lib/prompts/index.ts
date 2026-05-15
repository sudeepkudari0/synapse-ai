import { PromptContext, PromptTemplate } from './types';
import { getBehavioralPrompt } from './templates/behavioral';
import { getTechnicalPrompt } from './templates/technical';
import { getSystemDesignPrompt } from './templates/system-design';
import { getCodingPrompt } from './templates/coding';
import { getHRScreeningPrompt } from './templates/hr-screening';
import { getGeneralPrompt } from './templates/general';

export * from './types';

export const getPromptTemplate = (context: PromptContext): PromptTemplate => {
    switch (context.interviewType) {
        case 'behavioral':
            return getBehavioralPrompt(context);
        case 'technical':
            return getTechnicalPrompt(context);
        case 'system-design':
            return getSystemDesignPrompt(context);
        case 'coding':
            return getCodingPrompt(context);
        case 'hr-screening':
            return getHRScreeningPrompt(context);
        case 'general':
        case 'case-study': // Fallback for case study until we implement a specific template
        default:
            return getGeneralPrompt(context);
    }
};
