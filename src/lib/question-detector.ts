export type DetectionMode = 'regex' | 'llm' | 'hybrid';

const REGEX_PATTERN = /^(what|where|when|why|who|how|can you|could you|tell me|would you|do you|please explain|is there|are there|describe|walk me through)/i;

export async function isQuestion(
    text: string, 
    context: string[], 
    mode: DetectionMode = 'hybrid'
): Promise<{ isQuestion: boolean; confidence: number }> {
    const trimmed = text.trim();
    if (!trimmed) return { isQuestion: false, confidence: 0 };

    // Fast path: literal question mark
    if (trimmed.includes('?')) {
        return { isQuestion: true, confidence: 1.0 };
    }

    const checkRegex = () => {
        return REGEX_PATTERN.test(trimmed);
    };

    if (mode === 'regex') {
        return { isQuestion: checkRegex(), confidence: 0.8 };
    }

    // Try LLM approach
    try {
        const systemPrompt = "Given this conversation context, is the last statement a question or prompt that expects a candidate's response? Reply ONLY with the exact word 'YES' or 'NO'. Do not include any other text.";
        
        let promptText = "";
        if (context.length > 0) {
            promptText += "Context:\n" + context.slice(-3).join('\n') + "\n\n";
        }
        promptText += "Statement: " + trimmed;

        // Race LLM call against a 600ms timeout
        const llmPromise = window.electronAPI.llmGenerate({
            systemPrompt,
            prompt: promptText,
            temperature: 0.1,
            maxTokens: 5,
            stream: false
        });

        const timeoutPromise = new Promise<any>((_, reject) => {
            setTimeout(() => reject(new Error('LLM Timeout')), 600);
        });

        const result = await Promise.race([llmPromise, timeoutPromise]);
        
        if (result && result.success && result.text) {
            const answer = result.text.trim().toUpperCase();
            if (answer.includes('YES')) {
                return { isQuestion: true, confidence: 0.95 };
            } else if (answer.includes('NO')) {
                return { isQuestion: false, confidence: 0.95 };
            }
        }
        
        throw new Error("Invalid LLM response or failure");

    } catch (error) {
        if (mode === 'hybrid') {
            console.log('Falling back to regex for question detection due to:', error instanceof Error ? error.message : 'Unknown error');
            return { isQuestion: checkRegex(), confidence: 0.6 };
        }
        return { isQuestion: false, confidence: 0 };
    }
}
