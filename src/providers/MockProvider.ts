import { BaseProvider } from './BaseProvider';
import { ProviderType, LLMResponse } from '../types';

/**
 * A mock provider that returns placeholder responses for testing
 * Used when real API keys aren't available
 */
export class MockProvider extends BaseProvider {
    private providerType: ProviderType;
    
    constructor(providerType: ProviderType, defaultModel: string = 'mock-model') {
        super('mock-api-key', defaultModel);
        this.providerType = providerType;
    }

    getProviderType(): ProviderType {
        return this.providerType;
    }

    async getAvailableModels(): Promise<string[]> {
        // Return a mock list of models based on provider type
        switch (this.providerType) {
            case ProviderType.OPENAI:
                return ['gpt-4', 'gpt-3.5-turbo'];
            case ProviderType.ANTHROPIC:
                return ['claude-2', 'claude-instant-1'];
            case ProviderType.GOOGLE:
                return ['gemini-1.5-pro', 'gemini-1.0-pro'];
            default:
                return ['mock-model'];
        }
    }

    async generateCompletion(
        messages: { role: string; content: string }[],
        model?: string,
        temperature?: number,
        maxTokens?: number
    ): Promise<LLMResponse> {
        // Generate a mock response based on the last message
        const lastMessage = messages[messages.length - 1];
        const response = this.generateMockResponse(lastMessage.content);
        
        return {
            content: response,
            usage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
            }
        };
    }

    async generateStreamingCompletion(
        messages: { role: string; content: string }[],
        callback: (chunk: string, done: boolean) => void,
        model?: string,
        temperature?: number,
        maxTokens?: number
    ): Promise<void> {
        // Generate a mock response and stream it word by word
        const lastMessage = messages[messages.length - 1];
        const response = this.generateMockResponse(lastMessage.content);
        
        // Split the response into words and stream them
        const words = response.split(' ');
        
        for (let i = 0; i < words.length; i++) {
            // Add a small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            const isDone = i === words.length - 1;
            
            callback(word, isDone);
        }
    }

    formatMessages(messages: { role: string; content: string }[]): any {
        // Just return the messages as is for the mock provider
        return messages;
    }

    async validateApiKey(): Promise<boolean> {
        // Always return true for the mock provider
        return true;
    }

    /**
     * Generate a mock response based on the input message
     */
    private generateMockResponse(message: string): string {
        // If the message is empty or very short, return a generic response
        if (!message || message.length < 5) {
            return `This is a mock response from the ${this.providerType} provider. Please note that this is using a mock provider for testing purposes only. To get real responses, you need to configure API keys in the settings.`;
        }

        // Generate a more contextual response based on the input
        if (message.includes('?')) {
            return `This is a mock answer to your question from the ${this.providerType} provider. In a real scenario with valid API keys, you would receive an actual response from the AI model. This is just a placeholder response for testing the UI.`;
        }

        if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
            return `Hello! I'm a mock ${this.providerType} provider. I'm here to help you test the Panel of Experts plugin. To get real responses, please configure your API keys in the settings.`;
        }

        // Default response
        return `I'm a mock ${this.providerType} expert responding to your message. This is a placeholder response for testing the plugin UI without real API keys. The message you sent was about: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`;
    }
} 