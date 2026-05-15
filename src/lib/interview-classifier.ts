import { InterviewType } from './prompts/types';

// Simple weighted keyword scoring for fast, local classification
const KEYWORD_MAP: Record<InterviewType, Record<string, number>> = {
    'behavioral': {
        'tell me about a time': 10,
        'give me an example': 10,
        'conflict': 5,
        'failure': 5,
        'proudest': 5,
        'disagreed': 5,
        'mistake': 5,
        'challenge': 5,
        'leadership': 3,
        'teamwork': 3,
    },
    'system-design': {
        'system design': 10,
        'design a': 8,
        'architecture': 5,
        'database': 3,
        'scale': 5,
        'millions of users': 8,
        'high availability': 5,
        'load balancer': 5,
        'caching': 3,
        'microservices': 5,
    },
    'coding': {
        'o(n)': 10,
        'array': 3,
        'tree': 3,
        'graph': 3,
        'sort': 3,
        'leetcode': 5,
        'algorithm': 5,
        'time complexity': 8,
        'space complexity': 8,
        'binary search': 5,
        'dynamic programming': 5,
        'hash map': 3,
        'linked list': 3,
    },
    'hr-screening': {
        'salary': 8,
        'expectations': 5,
        'visa': 10,
        'sponsorship': 10,
        'start date': 8,
        'notice period': 8,
        'compensation': 8,
        'benefits': 5,
        'relocate': 5,
    },
    'technical': {
        'explain how': 5,
        'difference between': 5,
        'how does': 3,
        'what is': 2,
        'react': 2,
        'javascript': 2,
        'typescript': 2,
        'node': 2,
        'promise': 3,
        'async': 3,
    },
    'case-study': {
        'case study': 10,
        'scenario': 3,
        'metrics': 3,
        'kpi': 3,
        'growth': 2,
        'retention': 2,
    },
    'general': {}
};

export function classifyQuestion(text: string): InterviewType {
    const lowerText = text.toLowerCase();
    
    let maxScore = 0;
    let bestMatch: InterviewType = 'general';

    for (const [type, keywords] of Object.entries(KEYWORD_MAP)) {
        let score = 0;
        for (const [keyword, weight] of Object.entries(keywords)) {
            // Simple string matching. For exact phrase matching without word boundaries
            // it's slightly naive but fast and usually good enough.
            if (lowerText.includes(keyword)) {
                score += weight;
            }
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = type as InterviewType;
        }
    }

    // Require a minimum confidence score to override 'general'
    if (maxScore < 5) {
        return 'general';
    }

    return bestMatch;
}
