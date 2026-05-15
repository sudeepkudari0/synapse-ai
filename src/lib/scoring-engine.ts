/**
 * Scoring Engine for Practice Mode
 * Provides multi-dimensional scoring and progress tracking across sessions.
 */

export interface AnswerScore {
    questionId: string;
    question: string;
    interviewType: string;
    dimensions: {
        completeness: number;  // 1-10
        structure: number;     // 1-10
        specificity: number;   // 1-10
        relevance: number;     // 1-10
        communication: number; // 1-10
    };
    overall: number;           // Weighted average
    feedback: string;
    timestamp: string;
}

export interface SessionProgress {
    sessionId: string;
    interviewType: string;
    date: string;
    averageScore: number;
    dimensionAverages: {
        completeness: number;
        structure: number;
        specificity: number;
        relevance: number;
        communication: number;
    };
    questionCount: number;
}

export interface ProgressData {
    sessions: SessionProgress[];
    lastUpdated: string;
}

const DIMENSION_WEIGHTS = {
    completeness: 0.25,
    structure: 0.20,
    specificity: 0.25,
    relevance: 0.20,
    communication: 0.10,
};

/**
 * Calculate a weighted overall score from dimension scores.
 */
export function calculateOverallScore(dimensions: AnswerScore['dimensions']): number {
    const weighted =
        dimensions.completeness * DIMENSION_WEIGHTS.completeness +
        dimensions.structure * DIMENSION_WEIGHTS.structure +
        dimensions.specificity * DIMENSION_WEIGHTS.specificity +
        dimensions.relevance * DIMENSION_WEIGHTS.relevance +
        dimensions.communication * DIMENSION_WEIGHTS.communication;
    return Math.round(weighted * 10) / 10;
}

/**
 * Get the evaluator prompt that returns multi-dimensional scoring.
 */
export function getScoringPrompt(question: string, answer: string, interviewType: string, role: string): { system: string; user: string } {
    return {
        system: `You are an expert interview evaluator. Score the candidate's answer on 5 dimensions, each from 1-10.

Dimensions:
1. Completeness (1-10): Does the answer fully address the question? Are all parts covered?
2. Structure (1-10): Is the answer well-organized? (STAR for behavioral, systematic for technical)
3. Specificity (1-10): Does the answer include specific examples, data, metrics?
4. Relevance (1-10): Does the answer stay on-topic and address what was actually asked?
5. Communication (1-10): Is the answer clear, concise, and professionally delivered?

Return ONLY valid JSON in this exact format:
{
  "completeness": <number>,
  "structure": <number>,
  "specificity": <number>,
  "relevance": <number>,
  "communication": <number>,
  "feedback": "<1-2 sentences of specific, actionable feedback>"
}`,
        user: `Interview Type: ${interviewType}
Role: ${role}

Question: ${question}

Candidate's Answer: ${answer || '(No answer provided)'}

Score this answer:`,
    };
}

/**
 * Compute session-level progress from individual answer scores.
 */
export function computeSessionProgress(
    sessionId: string,
    interviewType: string,
    scores: AnswerScore[]
): SessionProgress {
    if (scores.length === 0) {
        return {
            sessionId,
            interviewType,
            date: new Date().toISOString(),
            averageScore: 0,
            dimensionAverages: { completeness: 0, structure: 0, specificity: 0, relevance: 0, communication: 0 },
            questionCount: 0,
        };
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
        sessionId,
        interviewType,
        date: new Date().toISOString(),
        averageScore: Math.round(avg(scores.map(s => s.overall)) * 10) / 10,
        dimensionAverages: {
            completeness: Math.round(avg(scores.map(s => s.dimensions.completeness)) * 10) / 10,
            structure: Math.round(avg(scores.map(s => s.dimensions.structure)) * 10) / 10,
            specificity: Math.round(avg(scores.map(s => s.dimensions.specificity)) * 10) / 10,
            relevance: Math.round(avg(scores.map(s => s.dimensions.relevance)) * 10) / 10,
            communication: Math.round(avg(scores.map(s => s.dimensions.communication)) * 10) / 10,
        },
        questionCount: scores.length,
    };
}

/**
 * Identify weakest dimensions from progress data.
 */
export function getWeakestDimensions(sessions: SessionProgress[], limit: number = 2): { dimension: string; average: number }[] {
    if (sessions.length === 0) return [];

    const dimensions = ['completeness', 'structure', 'specificity', 'relevance', 'communication'] as const;
    const averages = dimensions.map(dim => ({
        dimension: dim,
        average: Math.round(
            (sessions.reduce((sum, s) => sum + s.dimensionAverages[dim], 0) / sessions.length) * 10
        ) / 10,
    }));

    return averages.sort((a, b) => a.average - b.average).slice(0, limit);
}

/**
 * Get score trend direction for a dimension across recent sessions.
 */
export function getScoreTrend(sessions: SessionProgress[], dimension: keyof SessionProgress['dimensionAverages']): 'improving' | 'declining' | 'stable' {
    if (sessions.length < 2) return 'stable';

    const recent = sessions.slice(-5); // Last 5 sessions
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const avgFirst = firstHalf.reduce((s, p) => s + p.dimensionAverages[dimension], 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, p) => s + p.dimensionAverages[dimension], 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;
    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'declining';
    return 'stable';
}

/**
 * Render a simple text-based bar chart for a score (1-10).
 */
export function renderScoreBar(score: number, maxWidth: number = 10): string {
    const filled = Math.round(score);
    const empty = maxWidth - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${score.toFixed(1)}`;
}
