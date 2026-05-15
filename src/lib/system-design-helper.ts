/**
 * System Design Interview Helper
 * Detects current phase, suggests transitions, and provides estimation helpers.
 */

export type SystemDesignPhase = 'requirements' | 'estimation' | 'high-level' | 'deep-dive' | 'trade-offs';

interface PhaseInfo {
    phase: SystemDesignPhase;
    label: string;
    emoji: string;
    transitionPrompts: string[];
    suggestedComponents: string[];
}

const PHASE_KEYWORDS: Record<SystemDesignPhase, string[]> = {
    requirements: [
        'functional requirements', 'non-functional', 'what features', 'use cases',
        'who are the users', 'what should', 'scope', 'clarify', 'assumptions',
        'how many users', 'what kind of', 'requirements',
    ],
    estimation: [
        'how many requests', 'queries per second', 'qps', 'throughput', 'bandwidth',
        'storage', 'capacity', 'estimate', 'calculation', 'how much data',
        'traffic', 'latency', 'SLA', 'availability', 'back of the envelope',
    ],
    'high-level': [
        'high level', 'architecture', 'components', 'api design', 'api endpoints',
        'database schema', 'data model', 'overall design', 'system diagram',
        'load balancer', 'service', 'microservice',
    ],
    'deep-dive': [
        'deep dive', 'let\'s dig into', 'how would you handle', 'scaling',
        'caching', 'replication', 'sharding', 'partitioning', 'consistency',
        'message queue', 'notification', 'search', 'indexing', 'CDN',
    ],
    'trade-offs': [
        'trade-off', 'tradeoff', 'pros and cons', 'alternatives', 'why not',
        'bottleneck', 'single point of failure', 'what if', 'how would you improve',
        'monitoring', 'failure', 'disaster recovery',
    ],
};

const PHASE_INFO: Record<SystemDesignPhase, PhaseInfo> = {
    requirements: {
        phase: 'requirements',
        label: 'Requirements Gathering',
        emoji: '📋',
        transitionPrompts: [
            'Now that we have requirements, shall we estimate the scale?',
            'Should I start with back-of-the-envelope calculations?',
        ],
        suggestedComponents: [],
    },
    estimation: {
        phase: 'estimation',
        label: 'Estimation',
        emoji: '🧮',
        transitionPrompts: [
            'With these numbers in mind, let me propose the high-level architecture.',
            'Based on these estimates, here\'s my initial design...',
        ],
        suggestedComponents: [],
    },
    'high-level': {
        phase: 'high-level',
        label: 'High-Level Design',
        emoji: '📐',
        transitionPrompts: [
            'I\'d like to deep-dive into the most critical component.',
            'Shall I walk through how this handles [specific scenario]?',
        ],
        suggestedComponents: ['Load Balancer', 'API Gateway', 'Application Server', 'Database', 'Cache', 'CDN'],
    },
    'deep-dive': {
        phase: 'deep-dive',
        label: 'Deep Dive',
        emoji: '🔬',
        transitionPrompts: [
            'Let me discuss some trade-offs of this approach.',
            'Now let\'s consider the bottlenecks and potential improvements.',
        ],
        suggestedComponents: ['Message Queue', 'Search Index', 'Object Storage', 'Rate Limiter', 'Notification Service'],
    },
    'trade-offs': {
        phase: 'trade-offs',
        label: 'Trade-offs & Improvements',
        emoji: '⚖️',
        transitionPrompts: [
            'To summarize the key design decisions...',
            'If I had more time, I would also consider...',
        ],
        suggestedComponents: ['Monitoring/Alerting', 'Circuit Breaker', 'Backup/DR'],
    },
};

/**
 * Detect the current phase of a system design interview based on transcript content.
 */
export function detectPhase(transcript: string): PhaseInfo {
    const lowerTranscript = transcript.toLowerCase();
    // Take last ~500 chars for recency bias
    const recentText = lowerTranscript.slice(-500);

    let bestPhase: SystemDesignPhase = 'requirements';
    let bestScore = 0;

    for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
        const score = keywords.reduce((acc, keyword) => {
            // Recent matches count more
            const recentMatches = (recentText.match(new RegExp(keyword, 'gi')) || []).length * 2;
            const totalMatches = (lowerTranscript.match(new RegExp(keyword, 'gi')) || []).length;
            return acc + recentMatches + totalMatches;
        }, 0);

        if (score > bestScore) {
            bestScore = score;
            bestPhase = phase as SystemDesignPhase;
        }
    }

    return PHASE_INFO[bestPhase];
}

/**
 * Quick estimation helpers for system design interviews.
 */
export function estimateQPS(users: number, actionsPerDay: number): string {
    const qps = Math.round((users * actionsPerDay) / 86400);
    const peakQps = qps * 3; // 3x peak factor
    return `~${qps} QPS (avg), ~${peakQps} QPS (peak, 3x factor)`;
}

export function estimateStorage(recordSizeBytes: number, recordsPerDay: number, retentionYears: number): string {
    const dailyBytes = recordSizeBytes * recordsPerDay;
    const totalBytes = dailyBytes * 365 * retentionYears;

    const formatBytes = (bytes: number): string => {
        if (bytes >= 1e15) return `${(bytes / 1e15).toFixed(1)} PB`;
        if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
        if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
        if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
        return `${bytes} bytes`;
    };

    return `Daily: ${formatBytes(dailyBytes)}, Total (${retentionYears}yr): ${formatBytes(totalBytes)}`;
}

/**
 * Suggest system components based on detected requirements.
 */
export function suggestComponents(transcript: string): string[] {
    const lower = transcript.toLowerCase();
    const suggestions: string[] = [];

    const componentTriggers: [string[], string][] = [
        [['real-time', 'live', 'websocket', 'push notification'], 'WebSocket Server / Push Service'],
        [['upload', 'image', 'video', 'file', 'media'], 'Object Storage (S3/GCS) + CDN'],
        [['search', 'full-text', 'autocomplete', 'typeahead'], 'Search Engine (Elasticsearch)'],
        [['chat', 'messaging', 'message'], 'Message Queue (Kafka/RabbitMQ)'],
        [['cache', 'fast read', 'hot data', 'frequently accessed'], 'Cache Layer (Redis/Memcached)'],
        [['geolocation', 'nearby', 'location', 'map', 'geo'], 'Geospatial Index (PostGIS / Quadtree)'],
        [['rate limit', 'throttle', 'abuse', 'ddos'], 'Rate Limiter / API Gateway'],
        [['analytics', 'dashboard', 'metrics', 'reporting'], 'Analytics Pipeline (OLAP)'],
        [['notification', 'email', 'sms', 'alert'], 'Notification Service'],
        [['payment', 'transaction', 'billing'], 'Payment Gateway + Transaction Log'],
    ];

    for (const [triggers, component] of componentTriggers) {
        if (triggers.some(t => lower.includes(t))) {
            suggestions.push(component);
        }
    }

    return suggestions;
}
