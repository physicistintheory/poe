import OpenAI from 'openai';
import { BaseProvider } from './BaseProvider';
import { ProviderType, LLMResponse } from '../types';

export class OpenAIProvider extends BaseProvider {
    private client: OpenAI;

    constructor(apiKey: string, defaultModel: string = 'gpt-4') {
        super(apiKey, defaultModel);
        this.client = new OpenAI({
            apiKey: this.apiKey
        });
    }

    getProviderType(): ProviderType {
        return ProviderType.OPENAI;
    }

    async getAvailableModels(): Promise<string[]> {
        try {
            const models = await this.client.models.list();
            // Filter for chat models only
            return models.data
                .filter(model => model.id.includes('gpt'))
                .map(model => model.id);
        } catch (error) {
            console.error('Error fetching OpenAI models:', error);
            return ['gpt-4', 'gpt-3.5-turbo']; // Fallback to default models
        }
    }

    async generateCompletion(
        messages: { role: string; content: string }[],
        model?: string,
        temperature?: number,
        maxTokens?: number
    ): Promise<LLMResponse> {
        const formattedMessages = this.formatMessages(messages);

        try {
            const response = await this.client.chat.completions.create({
                model: model || this.defaultModel,
                messages: formattedMessages,
                temperature: temperature ?? 0.7,
                max_tokens: maxTokens,
            });

            return {
                content: response.choices[0]?.message?.content || '',
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0,
                }
            };
        } catch (error) {
            console.error('Error generating OpenAI completion:', error);
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
            const stream = await this.client.chat.completions.create({
                model: model || this.defaultModel,
                messages: formattedMessages,
                temperature: temperature ?? 0.7,
                max_tokens: maxTokens,
                stream: true,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                const done = chunk.choices[0]?.finish_reason === 'stop';
                callback(content, done);
            }
        } catch (error) {
            console.error('Error generating OpenAI streaming completion:', error);
            throw error;
        }
    }

    formatMessages(messages: { role: string; content: string }[]): any {
        // OpenAI already uses {role, content} format, so we just return as is
        // but ensure the roles are valid OpenAI roles
        return messages.map(message => {
            // Map our roles to OpenAI roles
            let role = message.role;
            if (role !== 'system' && role !== 'user' && role !== 'assistant') {
                role = 'assistant'; // Default to assistant for expert/moderator
            }
            return {
                role,
                content: message.content
            };
        });
    }

    async validateApiKey(): Promise<boolean> {
        try {
            // Just get a list of models as a simple validation
            await this.client.models.list();
            return true;
        } catch (error) {
            return false;
        }
    }
} 