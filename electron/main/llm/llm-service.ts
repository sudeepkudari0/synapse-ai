import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

/**
 * LLM generation options
 */
export interface LLMOptions {
    systemPrompt: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    imageData?: string; // Base64 encoded image for vision APIs
}

/**
 * LLM configuration from environment
 */
interface LLMConfig {
    geminiApiKey: string;
    groqApiKey: string;
    geminiModel: string;
    groqModel: string;
}

/**
 * Cloud-based LLM Service
 * Tries Google Gemini first, automatically falls back to Groq on error.
 * 
 * Environment Variables:
 * - GEMINI_API_KEY: Your Google Gemini API key
 * - GROQ_API_KEY: Your Groq API key
 * - GEMINI_MODEL: Override default Gemini model
 * - GROQ_MODEL: Override default Groq model
 */
export class LLMService {
    private config: LLMConfig;
    private geminiClient: GoogleGenAI;
    private groqClient: OpenAI;

    // Default models
    private static readonly DEFAULT_MODELS = {
        gemini: 'gemini-2.0-flash', // Supports vision
        groq: 'llama-4-scout-17b-16e-instruct', // Supports vision
    };

    constructor(config?: Partial<LLMConfig>) {
        // Strip quotes if they exist in the env vars
        const cleanKey = (key?: string) => key?.replace(/^["']|["']$/g, '');
        const geminiApiKey = cleanKey(process.env.GEMINI_API_KEY);
        const groqApiKey = cleanKey(process.env.GROQ_API_KEY);

        console.log("gemini api key", geminiApiKey);
        console.log("groq api key", groqApiKey);

        if (!geminiApiKey || !groqApiKey) {
            throw new Error(
                `Missing API keys. Both GEMINI_API_KEY and GROQ_API_KEY must be set in the environment. ` +
                `Found Gemini: ${!!geminiApiKey}, Found Groq: ${!!groqApiKey}`
            );
        }

        this.config = {
            geminiApiKey,
            groqApiKey,
            geminiModel: process.env.GEMINI_MODEL || LLMService.DEFAULT_MODELS.gemini,
            groqModel: process.env.GROQ_MODEL || LLMService.DEFAULT_MODELS.groq,
        };

        // Initialize Gemini
        this.geminiClient = new GoogleGenAI({
            apiKey: this.config.geminiApiKey,
        });

        // Initialize Groq (via OpenAI SDK pointing to GroqCloud)
        this.groqClient = new OpenAI({
            apiKey: this.config.groqApiKey,
            baseURL: 'https://api.groq.com/openai/v1',
        });
    }

    /**
     * Generate text with automatic fallback from Gemini to Groq
     */
    async generate(options: LLMOptions): Promise<{ text: string; stream?: AsyncIterable<string> }> {
        if (options.stream) {
            return {
                text: '',
                stream: this.streamGenerateWithFallback(options),
            };
        } else {
            const text = await this.generateTextWithFallback(options);
            return { text };
        }
    }

    /**
     * Non-streaming fallback mechanism
     */
    private async generateTextWithFallback(options: LLMOptions): Promise<string> {
        try {
            console.log('[LLMService] Trying Gemini...');
            return await this.generateGemini(options);
        } catch (error) {
            console.error('[LLMService] Gemini failed:', error, '- Falling back to Groq...');
            return await this.generateGroq(options);
        }
    }

    /**
     * Streaming fallback mechanism
     */
    private async *streamGenerateWithFallback(options: LLMOptions): AsyncIterable<string> {
        try {
            console.log('[LLMService] Trying Gemini (Stream)...');
            const stream = this.streamGemini(options);
            const iterator = stream[Symbol.asyncIterator]();
            let firstResult;

            // Try to fetch the first chunk to catch connection/auth/rate-limit errors
            try {
                firstResult = await iterator.next();
            } catch (err) {
                throw err; // Re-throw to trigger the Groq fallback
            }

            // If we successfully got the first chunk, yield it
            if (!firstResult.done) {
                yield firstResult.value;

                // Then yield the rest of the stream normally
                while (true) {
                    const result = await iterator.next();
                    if (result.done) break;
                    yield result.value;
                }
            }
            return; // Success with Gemini, no need for Groq
        } catch (error) {
            console.error('[LLMService] Gemini Stream failed:', error, '- Falling back to Groq...');
        }

        // Fallback to Groq if Gemini failed
        console.log('[LLMService] Trying Groq (Stream)...');
        yield* this.streamGroq(options);
    }

    // ─── Gemini Implementation ───

    private async generateGemini(options: LLMOptions): Promise<string> {
        const contentParts: any[] = [{ text: options.prompt }];

        if (options.imageData) {
            contentParts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: options.imageData,
                },
            });
        }

        const response = await this.geminiClient.models.generateContent({
            model: this.config.geminiModel,
            contents: contentParts,
            config: {
                systemInstruction: options.systemPrompt,
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? 1024,
            },
        });

        return response.text || '';
    }

    private async *streamGemini(options: LLMOptions): AsyncIterable<string> {
        const contentParts: any[] = [{ text: options.prompt }];

        if (options.imageData) {
            contentParts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: options.imageData,
                },
            });
        }

        const stream = await this.geminiClient.models.generateContentStream({
            model: this.config.geminiModel,
            contents: contentParts,
            config: {
                systemInstruction: options.systemPrompt,
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? 1024,
            },
        });

        for await (const chunk of stream) {
            if (chunk.text) {
                yield chunk.text;
            }
        }
    }

    // ─── Groq Implementation ───

    private async generateGroq(options: LLMOptions): Promise<string> {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: options.systemPrompt },
        ];

        if (options.imageData) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: options.prompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/png;base64,${options.imageData}`,
                        },
                    },
                ],
            });
        } else {
            messages.push({ role: 'user', content: options.prompt });
        }

        const response = await this.groqClient.chat.completions.create({
            model: this.config.groqModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
        });

        return response.choices[0]?.message?.content || '';
    }

    private async *streamGroq(options: LLMOptions): AsyncIterable<string> {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: options.systemPrompt },
        ];

        if (options.imageData) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: options.prompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/png;base64,${options.imageData}`,
                        },
                    },
                ],
            });
        } else {
            messages.push({ role: 'user', content: options.prompt });
        }

        const stream = await this.groqClient.chat.completions.create({
            model: this.config.groqModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): Readonly<LLMConfig> {
        return { ...this.config };
    }

    /**
     * Check if the service is properly configured
     */
    isConfigured(): boolean {
        return !!this.config.geminiApiKey && !!this.config.groqApiKey;
    }
}

// Singleton instance
let llmService: LLMService | null = null;

/**
 * Get LLMService singleton instance
 * @param config - Optional configuration override
 */
export function getLLMService(config?: Partial<LLMConfig>): LLMService {
    if (!llmService) {
        llmService = new LLMService(config);
    }
    return llmService;
}

/**
 * Reset the singleton instance (useful for testing or changing providers)
 */
export function resetLLMService(): void {
    llmService = null;
}
