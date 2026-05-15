/**
 * ESL (English as a Second Language) support utilities.
 * Provides prompt modifiers and grammar checking for non-native speakers.
 */

/**
 * ESL prompt modifier to append to any prompt's system message.
 * Makes generated answers more accessible for non-native English speakers.
 */
export const ESL_PROMPT_MODIFIER = `
IMPORTANT — ESL Mode is ACTIVE. The candidate is a non-native English speaker. Adjust your response:
- Use simple, clear vocabulary (avoid idioms, slang, and culturally-specific references)
- Prefer short sentences (max 15 words each)
- Suggest pronunciation-safe alternatives for complex technical terms in parentheses
- Bold any words that might be difficult to pronounce
- Keep the answer structure extra clear with numbered steps or bullets
`;

/**
 * Common ESL grammar patterns to check in the user's transcript.
 * Returns gentle suggestions without being condescending.
 */
interface GrammarSuggestion {
    original: string;
    suggestion: string;
    rule: string;
}

const GRAMMAR_PATTERNS: { pattern: RegExp; check: (match: RegExpMatchArray) => GrammarSuggestion | null }[] = [
    {
        // "I am working" when "I worked" is better (past tense)
        pattern: /\bI was (\w+ing)\b/gi,
        check: (match) => {
            const verb = match[1];
            const pastTense = verb.replace(/ing$/, 'ed');
            return {
                original: match[0],
                suggestion: `I ${pastTense}`,
                rule: 'Use simple past tense for completed actions',
            };
        },
    },
    {
        // Missing articles
        pattern: /\b(is|was|as) (\w+) (of|for|in|at)\b/gi,
        check: (match) => {
            const word = match[2];
            if (['a', 'an', 'the', 'one', 'my', 'our', 'their'].includes(word.toLowerCase())) return null;
            return {
                original: match[0],
                suggestion: `${match[1]} a ${match[2]} ${match[3]}`,
                rule: 'Consider adding an article (a/an/the)',
            };
        },
    },
    {
        // "more better" → "better"
        pattern: /\bmore (better|worse|faster|slower|bigger|smaller)\b/gi,
        check: (match) => ({
            original: match[0],
            suggestion: match[1],
            rule: 'Comparative adjectives don\'t need "more"',
        }),
    },
    {
        // "I have experience in work" → "I have experience working"
        pattern: /\bexperience in (\w+)\b/gi,
        check: (match) => {
            if (match[1].endsWith('ing')) return null;
            return {
                original: match[0],
                suggestion: `experience ${match[1]}ing`,
                rule: 'Use the gerund form (-ing) after "experience"',
            };
        },
    },
    {
        // "Since 3 years" → "For 3 years"
        pattern: /\bsince (\d+) (years?|months?|weeks?)\b/gi,
        check: (match) => ({
            original: match[0],
            suggestion: `for ${match[1]} ${match[2]}`,
            rule: '"Since" is for a point in time, "for" is for duration',
        }),
    },
];

/**
 * Analyze transcript for common ESL grammar issues.
 * Returns only high-confidence suggestions.
 */
export function checkGrammar(transcript: string): GrammarSuggestion[] {
    const suggestions: GrammarSuggestion[] = [];

    for (const { pattern, check } of GRAMMAR_PATTERNS) {
        // Reset regex state
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(transcript)) !== null) {
            const suggestion = check(match);
            if (suggestion) {
                suggestions.push(suggestion);
            }
        }
    }

    // Deduplicate
    const seen = new Set<string>();
    return suggestions.filter(s => {
        const key = `${s.original}→${s.suggestion}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Supported languages for whisper transcription.
 */
export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ru', name: 'Russian' },
] as const;

/**
 * Get the appropriate whisper model for a given language.
 */
export function getWhisperModelForLanguage(language: string): string {
    // English uses the specialized English-only models (faster, more accurate)
    if (language === 'en') return 'small.en';
    // Non-English uses multilingual base model
    return 'base';
}
