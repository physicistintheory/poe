import { BaseProvider } from './BaseProvider';
import { ProviderType, LLMResponse } from '../types';
import fetch from 'node-fetch';

export class OllamaProvider extends BaseProvider {
    private baseUrl: string;

    constructor(apiKey: string = '', defaultModel: string = 'llama2:3b') {
        super(apiKey, defaultModel);
        this.baseUrl = 'http://localhost:11434/api';
    }

    getProviderType(): ProviderType {
        return 'ollama';
    }

    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/tags`);
            const data = await response.json();
            return data.models.map((model: any) => model.name);
        } catch (error) {
            console.error('Error fetching Ollama models:', error);
            return ['llama2:3b']; // Fallback to default model
        }
    }

    async generateCompletion(
        messages: { role: string; content: string }[],
        model: string = this.defaultModel,
        temperature: number = 0.7,
        maxTokens: number = 2000
    ): Promise<LLMResponse> {
        const formattedMessages = this.formatMessages(messages);
        const prompt = formattedMessages.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n');

        try {
            const response = await fetch(`${this.baseUrl}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    temperature,
                    max_tokens: maxTokens,
                    stream: false
                })
            });

            const data = await response.json();
            return {
                content: data.response,
                model: model,
                provider: this.getProviderType()
            };
        } catch (error) {
            console.error('Error generating completion:', error);
            throw error;
        }
    }

    async generateStreamingCompletion(
        messages: { role: string; content: string }[],
        callback: (chunk: string, done: boolean) => void,
        model: string = this.defaultModel,
        temperature: number = 0.7,
        maxTokens: number = 2000
    ): Promise<void> {
        const formattedMessages = this.formatMessages(messages);
        const prompt = formattedMessages.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n');

        try {
            const response = await fetch(`${this.baseUrl}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    temperature,
                    max_tokens: maxTokens,
                    stream: true
                })
            });

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    callback('', true);
                    break;
                }

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        callback(data.response, false);
                    } catch (e) {
                        console.error('Error parsing chunk:', e);
                    }
                }
            }
        } catch (error) {
            console.error('Error in streaming completion:', error);
            throw error;
        }
    }

    formatMessages(messages: { role: string; content: string }[]): any[] {
        // Convert our internal format to Ollama's format
        return messages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.getAvailableModels();
            return true;
        } catch (error) {
            return false;
        }
    }
} 