import { GenerativeServiceClient } from '@google-ai/generativelanguage';
import { GoogleAuth } from 'google-auth-library';
import { BaseProvider } from './BaseProvider';
import { ProviderType, LLMResponse } from '../types';

export class GoogleProvider extends BaseProvider {
    private client: GenerativeServiceClient;

    constructor(apiKey: string, defaultModel: string = '') {
        super(apiKey, defaultModel);
        // Create auth client
        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/generative-language',
            apiKey: this.apiKey
        });
        this.client = new GenerativeServiceClient({ auth });
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

            const responseContent = result[0].candidates?.[0]?.content;
            let content = '';

            if (responseContent?.parts && responseContent.parts.length > 0) {
                for (const part of responseContent.parts) {
                    if ('text' in part) {
                        content += part.text || '';
                    }
                }
            }

            return {
                content,
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
            // Google's GenerativeServiceClient doesn't have native streaming
            // so we'll simulate streaming with a regular call and then chunk the response
            const result = await this.client.generateContent({
                model: model || this.defaultModel,
                contents: formattedMessages,
                generationConfig: {
                    temperature: temperature ?? 0.7,
                    maxOutputTokens: maxTokens,
                }
            });

            const responseContent = result[0].candidates?.[0]?.content;

            if (responseContent?.parts && responseContent.parts.length > 0) {
                // For each part, simulate streaming by sending one word at a time
                for (const part of responseContent.parts) {
                    if ('text' in part && part.text) {
                        const text = part.text as string;
                        // Simulate streaming with words
                        const words = text.split(' ');
                        for (let i = 0; i < words.length; i++) {
                            callback(words[i] + ' ', false);
                            // Small delay to simulate streaming
                            await new Promise(r => setTimeout(r, 20));
                        }
                    }
                }
            }

            callback('', true); // Signal completion
        } catch (error) {
            console.error('Error generating Google AI streaming completion:', error);
            throw error;
        }
    }

    formatMessages(messages: { role: string; content: string }[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
        // Google's format is different from the common role/content format
        return messages.map(message => {
            const role = message.role === 'user' ? 'user' : 'model';
            return {
                role,
                parts: [{ text: message.content }]
            };
        });
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