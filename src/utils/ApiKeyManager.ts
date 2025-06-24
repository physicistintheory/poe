import { ProviderType } from '../types';

/**
 * Manages API keys for different providers using Cursor's configuration
 */
export class ApiKeyManager {
    private static instance: ApiKeyManager;
    private cursor: {
        getConfiguration: (key: string) => string | undefined;
        updateConfiguration: (key: string, value: string) => Promise<void>;
    };

    private constructor(cursor: {
        getConfiguration: (key: string) => string | undefined;
        updateConfiguration: (key: string, value: string) => Promise<void>;
    }) {
        this.cursor = cursor;
    }

    /**
     * Get singleton instance
     */
    static getInstance(cursor: {
        getConfiguration: (key: string) => string | undefined;
        updateConfiguration: (key: string, value: string) => Promise<void>;
    }): ApiKeyManager {
        if (!ApiKeyManager.instance) {
            ApiKeyManager.instance = new ApiKeyManager(cursor);
        }
        return ApiKeyManager.instance;
    }

    /**
     * Get API key for a provider from Cursor's configuration
     */
    getApiKey(provider: ProviderType): string | undefined {
        try {
            // Try to get API key from Cursor's configuration
            switch (provider) {
                case ProviderType.OPENAI:
                    return this.cursor.getConfiguration('poe.openaiApiKey');
                case ProviderType.ANTHROPIC:
                    return this.cursor.getConfiguration('poe.anthropicApiKey');
                case ProviderType.GEMINI:
                    return this.cursor.getConfiguration('poe.geminiApiKey');
                case ProviderType.OLLAMA:
                    return ''; // Ollama doesn't require an API key
                default:
                    return undefined;
            }
        } catch (error) {
            console.error(`Error getting API key for ${provider}:`, error);
            return undefined;
        }
    }

    /**
     * Set API key for a provider in Cursor's configuration
     */
    async setApiKey(provider: ProviderType, apiKey: string): Promise<boolean> {
        try {
            // Set API key in Cursor's configuration
            let configKey: string;

            switch (provider) {
                case ProviderType.OPENAI:
                    configKey = 'poe.openaiApiKey';
                    break;
                case ProviderType.ANTHROPIC:
                    configKey = 'poe.anthropicApiKey';
                    break;
                case ProviderType.GEMINI:
                    configKey = 'poe.geminiApiKey';
                    break;
                case ProviderType.OLLAMA:
                    configKey = 'poe.ollamaBaseUrl';
                    break;
                default:
                    return false;
            }

            await this.cursor.updateConfiguration(configKey, apiKey);
            return true;
        } catch (error) {
            console.error(`Error setting API key for ${provider}:`, error);
            return false;
        }
    }

    /**
     * Get all configured API keys
     */
    getAllApiKeys(): Record<ProviderType, string | undefined> {
        return {
            [ProviderType.OPENAI]: this.getApiKey(ProviderType.OPENAI),
            [ProviderType.ANTHROPIC]: this.getApiKey(ProviderType.ANTHROPIC),
            [ProviderType.GEMINI]: this.getApiKey(ProviderType.GEMINI),
            [ProviderType.OLLAMA]: this.getApiKey(ProviderType.OLLAMA)
        };
    }

    /**
     * Check if an API key is configured for a provider
     */
    hasApiKey(provider: ProviderType): boolean {
        const apiKey = this.getApiKey(provider);
        return apiKey !== undefined && apiKey !== '';
    }
} 