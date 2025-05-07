import { LanguageServiceClient } from '@google-ai/generativelanguage';
import { GoogleAuth } from 'google-auth-library';
import { BaseProvider } from './BaseProvider';
import { ProviderType, LLMResponse } from '../types';

export class GoogleProvider extends BaseProvider {
    private client: LanguageServiceClient;

    constructor(apiKey: string, defaultModel: string = 'gemini-1.5-pro') {
        super(apiKey, defaultModel);
        const auth = new GoogleAuth().fromAPIKey(this.apiKey);
        this.client = new LanguageServiceClient({ auth });
    }

    getProviderType(): ProviderType {
        return ProviderType.GOOGLE;
    }

    async getAvailableModels(): Promise<string[]> {
        // Google doesn't provide a public model listing API in the same way,
        // so we hardcode the known models
        return [
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-1.0-pro',
            'gemini-1.0-pro-vision'
        ];
    }

    async generateCompletion(
        messages: { role: string; content: string }[],
        model?: string,
        temperature?: number,
        maxTokens?: number
    ): Promise<LLMResponse> {
        const formattedMessages = this.formatMessages(messages);

        try {
            const result = await this.client.generateContent({
                model: model || this.defaultModel,
                contents: formattedMessages,
                generationConfig: {
                    temperature: temperature ?? 0.7,
                    maxOutputTokens: maxTokens,
                }
            });

            const response = result[0].candidates?.[0]?.content?.parts?.[0]?.text || '';

            return {
                content: response,
                usage: {
                    // Google does not provide token counts in the standard response
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                }
            };
        } catch (error) {
            console.error('Error generating Google AI completion:', error);
            throw error;
        }
    }

    async generateStreamingCompletion(
        messages: { role: string; content: string }[],
        callback: (chunk: string, done: boolean) => void,
        model?: string,
        temperature?: number,
        maxTokens?: number
    ): Promise<void> {
        const formattedMessages = this.formatMessages(messages);

        try {
            const streamingResult = await this.client.generateContentStream({
                model: model || this.defaultModel,
                contents: formattedMessages,
                generationConfig: {
                    temperature: temperature ?? 0.7,
                    maxOutputTokens: maxTokens,
                }
            });

            for await (const response of streamingResult.stream) {
                const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
                callback(text, false);
            }

            callback('', true); // Signal completion
        } catch (error) {
            console.error('Error generating Google AI streaming completion:', error);
            throw error;
        }
    }

    formatMessages(messages: { role: string; content: string }[]): any {
        // Google's format is different from the common role/content format
        // Convert our messages to Google's ContentPart[] format
        const formattedMessages: any[] = [];

        // Track the current role for combining consecutive messages from the same role
        let currentRole = '';
        let currentContent = '';

        for (const message of messages) {
            const role = message.role === 'user' ? 'user' : 'model';

            // If this is a new role or the first message, start a new message object
            if (role !== currentRole || currentRole === '') {
                // Add the previous message if it exists
                if (currentContent) {
                    formattedMessages.push({
                        role: currentRole,
                        parts: [{ text: currentContent }]
                    });
                }

                // Reset for the new message
                currentRole = role;
                currentContent = message.content;
            } else {
                // Same role as previous, so append to content
                currentContent += '\n' + message.content;
            }
        }

        // Don't forget to add the last message
        if (currentContent) {
            formattedMessages.push({
                role: currentRole,
                parts: [{ text: currentContent }]
            });
        }

        return formattedMessages;
    }

    async validateApiKey(): Promise<boolean> {
        try {
            // Simple request to verify API key is valid
            await this.client.generateContent({
                model: this.defaultModel,
                contents: [{
                    role: 'user',
                    parts: [{ text: 'Hello' }]
                }],
                generationConfig: {
                    maxOutputTokens: 10,
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }
} 