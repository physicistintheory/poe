import { ProviderType } from '../types';

/**
 * Manages API keys for different providers using Cursor's configuration
 */
export class ApiKeyManager {
    private static instance: ApiKeyManager;
    private cursor: any; // Cursor API instance

    private constructor(cursor: any) {
        this.cursor = cursor;
    }

    /**
     * Get singleton instance
     */
    static getInstance(cursor: any): ApiKeyManager {
        if (!ApiKeyManager.instance) {
            ApiKeyManager.instance = new ApiKeyManager(cursor);
        }
        return ApiKeyManager.instance;
    }

    /**
     * Get API key for a provider from Cursor settings
     */
    getApiKey(provider: ProviderType): string | undefined {
        try {
            // Try to get API key from Cursor's configuration
            switch (provider) {
                case ProviderType.OPENAI:
                    return this.cursor.getConfiguration('poe.apiKeys.openai');
                case ProviderType.ANTHROPIC:
                    return this.cursor.getConfiguration('poe.apiKeys.anthropic');
                case ProviderType.GOOGLE:
                    return this.cursor.getConfiguration('poe.apiKeys.google');
                default:
                    return undefined;
            }
        } catch (error) {
            console.error(`Error getting API key for ${provider}:`, error);
            return undefined;
        }
    }

    /**
     * Set API key for a provider in Cursor settings
     */
    async setApiKey(provider: ProviderType, apiKey: string): Promise<boolean> {
        try {
            // Set API key in Cursor's configuration
            let configKey: string;

            switch (provider) {
                case ProviderType.OPENAI:
                    configKey = 'poe.apiKeys.openai';
                    break;
                case ProviderType.ANTHROPIC:
                    configKey = 'poe.apiKeys.anthropic';
                    break;
                case ProviderType.GOOGLE:
                    configKey = 'poe.apiKeys.google';
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
            [ProviderType.GOOGLE]: this.getApiKey(ProviderType.GOOGLE)
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