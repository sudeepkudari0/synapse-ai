import { ChatBlock } from '../state';

export interface DeliveryMetrics {
    fillerWordCount: number;
    fillerWords: Record<string, number>;
    totalWords: number;
    talkTimeRatio: number;
    wpm: number;
}

const FILLER_WORDS = [
    'um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'right', 'so', 'i mean'
];

export function analyzeDelivery(conversation: ChatBlock[], sessionTimeSeconds: number): DeliveryMetrics {
    let fillerWordCount = 0;
    const fillerWordsMap: Record<string, number> = {};
    let totalWords = 0;
    
    // In our ChatBlock model we don't have explicit start/end times per block yet,
    // so we approximate talk time by word count assuming average speaking rate of 150 WPM.
    
    const userBlocks = conversation.filter(b => b.speaker === 'user');
    const combinedUserText = userBlocks.map(b => b.text.toLowerCase()).join(' ');
    
    const words = combinedUserText.split(/\s+/).filter(w => w.length > 0);
    totalWords = words.length;

    // Count exact matches of filler words
    FILLER_WORDS.forEach(filler => {
        // Regex to match whole words/phrases
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        const matches = combinedUserText.match(regex);
        if (matches) {
            fillerWordCount += matches.length;
            fillerWordsMap[filler] = matches.length;
        }
    });

    // Approximate talk time in seconds based on 150 words per minute (2.5 words per sec)
    const estimatedTalkTimeSeconds = totalWords / 2.5;
    const actualSessionTime = Math.max(sessionTimeSeconds, 1); // prevent div by zero
    
    // Ratio capped at 1.0
    const talkTimeRatio = Math.min(estimatedTalkTimeSeconds / actualSessionTime, 1.0);

    const wpm = sessionTimeSeconds > 0 ? Math.round((totalWords / sessionTimeSeconds) * 60) : 0;

    return {
        fillerWordCount,
        fillerWords: fillerWordsMap,
        totalWords,
        talkTimeRatio,
        wpm
    };
}
