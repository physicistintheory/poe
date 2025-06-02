import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './BaseProvider';
import { ProviderType, LLMResponse } from '../types';

export class AnthropicProvider extends BaseProvider {
    private client: Anthropic;

    constructor(apiKey: string, defaultModel: string = 'claude-3-sonnet-20240229') {
        super(apiKey, defaultModel);
        this.client = new Anthropic({
            apiKey: this.apiKey
        });
    }

    getProviderType(): ProviderType {
        return ProviderType.ANTHROPIC;
    }

    async getAvailableModels(): Promise<string[]> {
        // Anthropic doesn't provide a models list API, so we hardcode the known models
        return [
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
            'claude-3-5-sonnet-20240620',
            'claude-3-7-sonnet-20250219'
        ];
    }

    async generateCompletion(
        messages: { role: string; content: string }[],
        model?: string,
        temperature?: number,
        maxTokens?: number
    ): Promise<LLMResponse> {
        try {
            const formattedMessages = this.formatMessages(messages);
            const systemMessage = this.extractSystemMessage(messages);

            const response = await this.client.messages.create({
                model: model || this.defaultModel,
                system: systemMessage,
                messages: formattedMessages,
                temperature: temperature ?? 0.7,
                max_tokens: maxTokens || 1024,
            });

            // Extract the text content from the response
            let content = '';
            if (response.content && response.content.length > 0) {
                // Handle different content block types
                for (const block of response.content) {
                    if (block.type === 'text') {
                        content += block.text;
                    }
                }
            }

            return {
                content,
                usage: {
                    // Anthropic doesn't provide detailed token usage in the response
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                }
            };
        } catch (error) {
            console.error('Error generating Anthropic completion:', error);
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
        try {
            const formattedMessages = this.formatMessages(messages);
            const systemMessage = this.extractSystemMessage(messages);

            const stream = await this.client.messages.create({
                model: model || this.defaultModel,
                system: systemMessage,
                messages: formattedMessages,
                temperature: temperature ?? 0.7,
                max_tokens: maxTokens || 1024,
                stream: true,
            });

            for await (const chunk of stream) {
                // Handle different chunk types
                if (chunk.type === 'content_block_delta') {
                    // Handle text delta 
                    if (chunk.delta && typeof chunk.delta === 'object' && 'text' in chunk.delta) {
                        callback(chunk.delta.text as string, false);
                    }
                } else if (chunk.type === 'message_stop') {
                    callback('', true);
                }
            }
        } catch (error) {
            console.error('Error generating Anthropic streaming completion:', error);
            throw error;
        }
    }

    formatMessages(messages: { role: string; content: string }[]): { role: 'user' | 'assistant'; content: string }[] {
        // Filter out system messages as they are handled separately
        return messages
            .filter(message => message.role !== 'system')
            .map(message => {
                // Map our roles to Anthropic roles
                const role = message.role === 'user' ? 'user' : 'assistant';
                return {
                    role,
                    content: message.content
                };
            });
    }

    // Extract system message from the conversation
    private extractSystemMessage(messages: { role: string; content: string }[]): string {
        const systemMessage = messages.find(message => message.role === 'system');
        return systemMessage?.content || '';
    }

    async validateApiKey(): Promise<boolean> {
        try {
            // Make a minimal request to validate the API key
            await this.client.messages.create({
                model: this.defaultModel,
                system: '',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10,
            });
            return true;
        } catch (error) {
            return false;
        }
    }
} 