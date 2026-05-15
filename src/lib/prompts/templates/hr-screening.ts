import { PromptContext, PromptTemplate } from '../types';

interface HRContext extends PromptContext {
    salaryPreferences?: {
        currentSalary?: string;
        targetSalary?: string;
        negotiationStrategy?: 'deflect' | 'anchor-high' | 'market-rate';
    };
}

const SALARY_KEYWORDS = ['salary', 'compensation', 'pay', 'package', 'benefits', 'equity', 'offer', 'ctc', 'total comp'];
const RED_FLAG_KEYWORDS = ['gap', 'why did you leave', 'fired', 'terminated', 'short tenure', 'let go', 'laid off', 'unemployment'];

function detectQuestionType(question: string): 'salary' | 'red-flag' | 'general' {
    const lower = question.toLowerCase();
    if (SALARY_KEYWORDS.some(k => lower.includes(k))) return 'salary';
    if (RED_FLAG_KEYWORDS.some(k => lower.includes(k))) return 'red-flag';
    return 'general';
}

export const getHRScreeningPrompt = (context: HRContext): PromptTemplate => {
    const questionType = detectQuestionType(context.currentQuestion);
    const salaryPref = context.salaryPreferences;

    let salaryInstructions = '';
    if (questionType === 'salary' && salaryPref) {
        const strategy = salaryPref.negotiationStrategy || 'deflect';
        if (strategy === 'deflect') {
            salaryInstructions = `The candidate prefers to DEFLECT salary questions. Suggest saying: "I'm focused on finding the right role and team fit. I'd love to learn more about the total compensation structure for this position."`;
        } else if (strategy === 'anchor-high') {
            salaryInstructions = `The candidate wants to ANCHOR HIGH. Their target is ${salaryPref.targetSalary || 'competitive'}. Frame as: "Based on my experience and market research, I'm targeting [target range]. I'm open to discussing the full package."`;
        } else if (strategy === 'market-rate') {
            salaryInstructions = `The candidate wants to use MARKET RATE. Say: "I'm looking for a compensation package that's competitive with market rates for this role and level in this geography."`;
        }
    }

    let redFlagInstructions = '';
    if (questionType === 'red-flag') {
        redFlagInstructions = `This is a potentially sensitive question about gaps, departures, or career transitions. Frame the response DIPLOMATICALLY:
- Gaps: Frame as intentional (learning, caregiving, personal project)
- Departures: Focus on what you're moving TOWARD, not away from
- Short tenures: Emphasize what you learned and accomplished
- Never speak negatively about previous employers`;
    }

    return {
        system: `You are an expert career coach helping a candidate navigate an HR screening call.
HARD LIMIT: Response MUST be under 150 words. HR answers should be brief and confident.
Maintain a professional, positive, and collaborative tone.
${salaryInstructions}
${redFlagInstructions}
${questionType === 'general' ? 'If the question is about weaknesses or challenges, frame them positively as areas of intentional growth with specific actions taken.' : ''}`,
        
        user: `Candidate Background:
${context.resume || 'Not provided.'}

Target Role: ${context.targetRole || 'Not specified'}
Target Company: ${context.company || 'Not specified'}

Conversation History:
${context.conversationHistory}

HR Question:
${context.currentQuestion}

Provide the concise HR screening answer (under 150 words):`
    };
};

export { detectQuestionType, SALARY_KEYWORDS, RED_FLAG_KEYWORDS };
