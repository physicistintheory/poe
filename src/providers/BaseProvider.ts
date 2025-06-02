import { ProviderType, LLMResponse } from '../types';

/**
 * Base abstract class for all LLM providers
 */
export abstract class BaseProvider {
    protected apiKey: string;
    protected defaultModel: string;

    constructor(apiKey: string, defaultModel: string) {
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
    }

    /**
     * Get the provider type
     */
    abstract getProviderType(): ProviderType;

    /**
     * Get available models for this provider
     */
    abstract getAvailableModels(): Promise<string[]>;

    /**
     * Generate a completion based on the provided messages
     * @param messages Array of messages in the conversation
     * @param model Optional model to use, falls back to default
     * @param temperature Optional temperature for generation
     * @param maxTokens Optional max tokens to generate
     */
    abstract generateCompletion(
        messages: { role: string; content: string }[],
        model?: string,
        temperature?: number,
        maxTokens?: number
    ): Promise<LLMResponse>;

    /**
     * Generate a streaming completion that yields chunks of the response as they're generated
     * @param messages Array of messages in the conversation
     * @param callback Function to call with each chunk of the response
     * @param model Optional model to use, falls back to default
     * @param temperature Optional temperature for generation
     * @param maxTokens Optional max tokens to generate
     */
    abstract generateStreamingCompletion(
        messages: { role: string; content: string }[],
        callback: (chunk: string, done: boolean) => void,
        model?: string,
        temperature?: number,
        maxTokens?: number
    ): Promise<void>;

    /**
     * Format the provider-specific message format to our internal format
     * @param messages Internal message format
     * @returns Provider-specific format
     */
    abstract formatMessages(messages: { role: string; content: string }[]): unknown;

    /**
     * Check if the API key is valid by making a simple request
     */
    abstract validateApiKey(): Promise<boolean>;
} 