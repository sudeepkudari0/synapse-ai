import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { getSettings } from '../settings';

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
    ollamaModel: string;
    ollamaBaseUrl: string;
    useOllamaOnly: boolean;
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
    private ollamaClient: OpenAI;

    // Default models
    private static readonly DEFAULT_MODELS = {
        gemini: 'gemini-2.0-flash', // Supports vision
        groq: 'llama-4-scout-17b-16e-instruct', // Supports vision
        ollama: 'qwen2.5-vl', // Default local model
    };

    constructor(config?: Partial<LLMConfig>) {
        const settings = getSettings();
        
        // Strip quotes if they exist in the env vars (fallback to env if not in settings)
        const cleanKey = (key?: string) => key?.replace(/^["']|["']$/g, '');
        const geminiApiKey = cleanKey(settings.geminiApiKey || process.env.GEMINI_API_KEY);
        const groqApiKey = cleanKey(settings.groqApiKey || process.env.GROQ_API_KEY);

        console.log("gemini api key available:", !!geminiApiKey);
        console.log("groq api key available:", !!groqApiKey);

        if (!geminiApiKey && !groqApiKey) {
            console.warn(`[LLMService] Warning: No API keys configured in settings. Go to settings to add them.`);
        }

        this.config = {
            geminiApiKey: geminiApiKey || '',
            groqApiKey: groqApiKey || '',
            geminiModel: process.env.GEMINI_MODEL || LLMService.DEFAULT_MODELS.gemini,
            groqModel: process.env.GROQ_MODEL || LLMService.DEFAULT_MODELS.groq,
            ollamaModel: settings.ollamaModel || process.env.OLLAMA_MODEL || LLMService.DEFAULT_MODELS.ollama,
            ollamaBaseUrl: settings.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
            useOllamaOnly: settings.useOllamaOnly ?? false,
        };

        // Initialize Gemini
        if (this.config.geminiApiKey) {
            this.geminiClient = new GoogleGenAI({
                apiKey: this.config.geminiApiKey,
            });
        } else {
            this.geminiClient = null as any;
        }

        // Initialize Groq (via OpenAI SDK pointing to GroqCloud)
        if (this.config.groqApiKey) {
            this.groqClient = new OpenAI({
                apiKey: this.config.groqApiKey,
                baseURL: 'https://api.groq.com/openai/v1',
            });
        } else {
            this.groqClient = null as any;
        }

        // Initialize Ollama (via OpenAI SDK pointing to local instance)
        this.ollamaClient = new OpenAI({
            apiKey: 'ollama', // Dummy key required by SDK
            baseURL: this.config.ollamaBaseUrl,
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
            console.log(`[LLMService] Trying Ollama (${this.config.ollamaModel})...`);
            return await this.generateOllama(options);
        } catch (error) {
            if (this.config.useOllamaOnly) {
                console.error('[LLMService] Ollama failed and useOllamaOnly is enabled. Throwing error.');
                throw error;
            }
            console.error('[LLMService] Ollama failed:', error, '- Falling back to Gemini...');
            try {
                if (!this.geminiClient) throw new Error("Gemini API key not set in settings");
                console.log('[LLMService] Trying Gemini...');
                return await this.generateGemini(options);
            } catch (error2) {
                if (!this.groqClient) throw new Error("Both Gemini and Groq API keys are missing in settings");
                console.error('[LLMService] Gemini failed:', error2, '- Falling back to Groq...');
                return await this.generateGroq(options);
            }
        }
    }

    /**
     * Streaming fallback mechanism
     */
    private async *streamGenerateWithFallback(options: LLMOptions): AsyncIterable<string> {
        try {
            console.log(`[LLMService] Trying Ollama (Stream, ${this.config.ollamaModel})...`);
            const stream = this.streamOllama(options);
            const iterator = stream[Symbol.asyncIterator]();
            let firstResult;

            try {
                firstResult = await iterator.next();
            } catch (err) {
                throw err;
            }

            if (!firstResult.done) {
                yield firstResult.value;
                while (true) {
                    const result = await iterator.next();
                    if (result.done) break;
                    yield result.value;
                }
            }
            return;
        } catch (error) {
            if (this.config.useOllamaOnly) {
                console.error('[LLMService] Ollama Stream failed and useOllamaOnly is enabled. Throwing error.');
                throw error;
            }
            console.error('[LLMService] Ollama Stream failed:', error, '- Falling back to Gemini...');
        }

        try {
            if (!this.geminiClient) throw new Error("Gemini API key not set in settings");
            console.log('[LLMService] Trying Gemini (Stream)...');
            const stream = this.streamGemini(options);
            const iterator = stream[Symbol.asyncIterator]();
            let firstResult;

            try {
                firstResult = await iterator.next();
            } catch (err) {
                throw err;
            }

            if (!firstResult.done) {
                yield firstResult.value;
                while (true) {
                    const result = await iterator.next();
                    if (result.done) break;
                    yield result.value;
                }
            }
            return;
        } catch (error) {
            console.error('[LLMService] Gemini Stream failed:', error, '- Falling back to Groq...');
        }

        if (!this.groqClient) throw new Error("Both Gemini and Groq API keys are missing in settings");
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

    // ─── Ollama Implementation ───

    private async generateOllama(options: LLMOptions): Promise<string> {
        const directSystemPrompt = options.systemPrompt + "\n\nCRITICAL: Do not include any internal thought process, reasoning steps, or preamble. Provide only the direct answer.";
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: directSystemPrompt },
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

        try {
            const response = await this.ollamaClient.chat.completions.create({
                model: this.config.ollamaModel,
                messages,
                temperature: 0, // Force 0 for immediate, deterministic answers
                max_tokens: options.maxTokens,
                // @ts-ignore - Ollama specific parameter
                think: false,
            });

            return response.choices[0]?.message?.content || '';
        } catch (error: any) {
            // Handle non-JSON responses (like 404 or 500 HTML pages from Ollama)
            if (error.message && (error.message.includes('Unexpected token') || error.message.includes('valid JSON'))) {
                throw new Error(`Ollama model "${this.config.ollamaModel}" not found or Ollama server returned an error. Please check if the model is pulled and Ollama is running.`);
            }
            throw error;
        }
    }

    private async *streamOllama(options: LLMOptions): AsyncIterable<string> {
        const directSystemPrompt = options.systemPrompt + "\n\nCRITICAL: Do not include any internal thought process, reasoning steps, or preamble. Provide only the direct answer.";
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: directSystemPrompt },
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

        try {
            const stream = await this.ollamaClient.chat.completions.create({
                model: this.config.ollamaModel,
                messages,
                temperature: 0, // Force 0 for immediate, deterministic answers
                max_tokens: options.maxTokens,
                stream: true,
                // @ts-ignore - Ollama specific parameter
                think: false,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield content;
                }
            }
        } catch (error: any) {
            // Handle non-JSON responses (like 404 or 500 HTML pages from Ollama)
            if (error.message && (error.message.includes('Unexpected token') || error.message.includes('valid JSON'))) {
                throw new Error(`Ollama model "${this.config.ollamaModel}" not found or Ollama server returned an error. Please check if the model is pulled and Ollama is running.`);
            }
            throw error;
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
