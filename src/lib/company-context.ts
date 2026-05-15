/**
 * Company-specific interview preparation data.
 * Each company file contains values, interview structure, common questions, and tips.
 */

export interface CompanyData {
    name: string;
    values: string[];
    interviewStructure: string;
    commonQuestions: string[];
    evaluationCriteria: string[];
    tips: string[];
}

const COMPANY_DATABASE: Record<string, CompanyData> = {
    amazon: {
        name: 'Amazon',
        values: [
            'Customer Obsession', 'Ownership', 'Invent and Simplify', 'Are Right, A Lot',
            'Learn and Be Curious', 'Hire and Develop the Best', 'Insist on the Highest Standards',
            'Think Big', 'Bias for Action', 'Frugality', 'Earn Trust', 'Dive Deep',
            'Have Backbone; Disagree and Commit', 'Deliver Results', 'Strive to be Earth\'s Best Employer',
            'Success and Scale Bring Broad Responsibility',
        ],
        interviewStructure: 'Loop of 5-6 interviews. Each interviewer owns 2-3 Leadership Principles. Bar Raiser interview. Strong behavioral focus with STAR method expected.',
        commonQuestions: [
            'Tell me about a time you disagreed with your manager.',
            'Describe a time you had to make a decision with incomplete data.',
            'Tell me about your most challenging project and what you learned.',
            'How do you prioritize when everything is urgent?',
            'Tell me about a time you went above and beyond for a customer.',
        ],
        evaluationCriteria: [
            'Every answer must map to a Leadership Principle',
            'Data-driven results are heavily weighted',
            'Ownership mentality — "I" not "we"',
            'Specificity and depth of examples',
        ],
        tips: [
            'Prepare 2-3 stories per Leadership Principle',
            'Always quantify results (%, $, time saved)',
            'Use "I" language — they want YOUR contributions',
            'The Bar Raiser can veto — treat every interviewer equally',
        ],
    },
    google: {
        name: 'Google',
        values: ['Googleyness', 'General Cognitive Ability', 'Role-Related Knowledge', 'Leadership'],
        interviewStructure: 'Phone screen + onsite (4-5 interviews). Mix of coding, system design, behavioral (Googleyness). Hiring committee reviews all feedback independently.',
        commonQuestions: [
            'Why Google?',
            'Tell me about a time you influenced without authority.',
            'Describe a technically complex project you led.',
            'How do you handle ambiguity?',
        ],
        evaluationCriteria: [
            'Googleyness: comfort with ambiguity, collaborative, intellectually humble',
            'General Cognitive Ability: structured thinking, learning agility',
            'Strong coding skills with clean, production-quality code',
        ],
        tips: [
            'Focus on collaborative problem-solving, not just individual brilliance',
            'Show intellectual curiosity and growth mindset',
            'System design: start broad, then deep-dive when prompted',
            'The hiring committee cares more about the interview packet than any single interviewer',
        ],
    },
    meta: {
        name: 'Meta',
        values: ['Move Fast', 'Be Bold', 'Focus on Impact', 'Be Open', 'Build Social Value'],
        interviewStructure: 'Phone screen + onsite (4-5 interviews). Heavy coding focus. System design for senior+. Behavioral uses "Move fast" culture fit.',
        commonQuestions: [
            'Tell me about a time you had to move fast and break things.',
            'How do you prioritize impact?',
            'Describe a time you challenged the status quo.',
            'Tell me about building something at scale.',
        ],
        evaluationCriteria: [
            'Speed of execution with quality',
            'Impact-driven thinking',
            'Strong coding fundamentals',
            'Ability to work in fast-paced environment',
        ],
        tips: [
            'Emphasize speed and iteration over perfection',
            'Show how you measure and optimize for impact',
            'Coding interviews are timed strictly — practice under pressure',
            'For system design, focus on scale (billions of users)',
        ],
    },
    microsoft: {
        name: 'Microsoft',
        values: ['Growth Mindset', 'Customer Obsessed', 'Diverse and Inclusive', 'One Microsoft', 'Making a Difference'],
        interviewStructure: 'Phone screen + onsite (4-5 interviews + "as appropriate" final interview with hiring manager). Mix of coding, design, behavioral.',
        commonQuestions: [
            'Why Microsoft?',
            'Tell me about a time you demonstrated a growth mindset.',
            'How do you handle feedback?',
            'Describe a time you collaborated across teams.',
        ],
        evaluationCriteria: [
            'Growth mindset is the #1 cultural signal',
            'Collaboration and empathy',
            'Technical depth appropriate to level',
            'Customer-centric thinking',
        ],
        tips: [
            'Research Satya Nadella\'s growth mindset culture',
            'Show humility and willingness to learn',
            'The "as appropriate" interview is the final decision maker',
            'Microsoft values diverse perspectives — highlight cross-functional work',
        ],
    },
    apple: {
        name: 'Apple',
        values: ['Secrecy', 'Attention to Detail', 'Innovation', 'Simplicity', 'User Experience'],
        interviewStructure: 'Very secretive process. Multiple rounds with cross-functional teams. Focus on craft, attention to detail, and passion for Apple products.',
        commonQuestions: [
            'What Apple product do you use most and how would you improve it?',
            'Tell me about a time you obsessed over quality.',
            'How do you handle working with limited information?',
            'Describe your approach to simplifying complex problems.',
        ],
        evaluationCriteria: [
            'Passion for Apple and its products',
            'Extreme attention to detail',
            'Ability to work in a secretive, compartmentalized environment',
            'Design thinking and user empathy',
        ],
        tips: [
            'Know Apple products inside and out',
            'Be prepared for very specific, detail-oriented questions',
            'Show passion — Apple hires people who love the mission',
            'Don\'t ask about products in development',
        ],
    },
    netflix: {
        name: 'Netflix',
        values: ['Judgment', 'Communication', 'Curiosity', 'Courage', 'Passion', 'Selflessness', 'Innovation', 'Inclusion', 'Integrity', 'Impact'],
        interviewStructure: 'Culture fit is paramount. Expect deep behavioral interviews around Netflix culture memo values.',
        commonQuestions: [
            'Tell me about a time you made a tough judgment call.',
            'How do you handle receiving candid feedback?',
            'Describe a situation where you chose impact over process.',
        ],
        evaluationCriteria: ['Freedom & Responsibility model', 'Keeper test mentality', 'Context over control'],
        tips: ['Read the Netflix Culture Memo thoroughly', 'Be ready to discuss compensation openly', 'Show independent decision-making'],
    },
    stripe: {
        name: 'Stripe',
        values: ['Users First', 'Move with Urgency', 'Think Rigorously', 'Trust and Amplify', 'Global Optimization'],
        interviewStructure: 'Take-home project + onsite. Heavy coding with real-world scenarios. System design for senior roles.',
        commonQuestions: ['Design a payment processing system.', 'How would you debug a failing API endpoint in production?'],
        evaluationCriteria: ['Clean, production-quality code', 'Systems thinking', 'Strong communication'],
        tips: ['Focus on API design and reliability', 'Understand payment processing fundamentals', 'Code quality matters more than speed'],
    },
    uber: {
        name: 'Uber',
        values: ['We build globally, we live locally', 'We celebrate differences', 'We act like owners', 'We do the right thing'],
        interviewStructure: 'Phone screen + onsite (5-6 rounds). Mix of coding, system design, and behavioral.',
        commonQuestions: ['Design a ride-sharing system.', 'Tell me about a time you dealt with ambiguity.'],
        evaluationCriteria: ['Scalability thinking', 'Problem-solving under constraints', 'Cultural alignment'],
        tips: ['Understand marketplace dynamics', 'Focus on geospatial and real-time systems', 'Show you can operate in a fast-paced environment'],
    },
    airbnb: {
        name: 'Airbnb',
        values: ['Champion the Mission', 'Be a Host', 'Embrace the Adventure', 'Be a Cereal Entrepreneur'],
        interviewStructure: 'Core Values interview is unique to Airbnb. Cross-functional panel.',
        commonQuestions: ['Why Airbnb?', 'Tell me about a time you went above and beyond for someone.', 'How do you build trust?'],
        evaluationCriteria: ['Mission alignment', 'Hospitality mindset', 'Creative problem-solving'],
        tips: ['Understand the hosting/guest experience deeply', 'Show genuine passion for travel and belonging', 'The core values interview is a must-pass'],
    },
    linkedin: {
        name: 'LinkedIn',
        values: ['Members First', 'Relationships Matter', 'Be Open, Honest, and Constructive', 'Demand Excellence', 'Take Intelligent Risks', 'Act Like an Owner'],
        interviewStructure: 'Phone screen + onsite. Standard tech interview with behavioral component.',
        commonQuestions: ['How would you improve LinkedIn?', 'Tell me about a time you took an intelligent risk.'],
        evaluationCriteria: ['User empathy', 'Data-driven decisions', 'Collaboration'],
        tips: ['Have opinions about the LinkedIn product', 'Show data-driven thinking', 'Emphasize professional network and career growth themes'],
    },
};

/**
 * Get company-specific context for prompt injection.
 * Uses fuzzy matching on company name.
 */
export function getCompanyContext(companyName: string): CompanyData | null {
    if (!companyName) return null;

    const normalized = companyName.toLowerCase().trim();

    // Direct match
    if (COMPANY_DATABASE[normalized]) {
        return COMPANY_DATABASE[normalized];
    }

    // Fuzzy match: check if company name contains or is contained by a known company
    for (const [key, data] of Object.entries(COMPANY_DATABASE)) {
        if (normalized.includes(key) || key.includes(normalized) || normalized.includes(data.name.toLowerCase())) {
            return data;
        }
    }

    return null;
}

/**
 * Format company context as a prompt section.
 */
export function formatCompanyContextForPrompt(companyName: string): string {
    const data = getCompanyContext(companyName);
    if (!data) return '';

    return `\n--- Company Context: ${data.name} ---
Core Values: ${data.values.join(', ')}
Interview Structure: ${data.interviewStructure}
Evaluation Criteria: ${data.evaluationCriteria.join('; ')}
Tips: ${data.tips.join('; ')}
---`;
}
