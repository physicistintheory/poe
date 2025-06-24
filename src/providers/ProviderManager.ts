import { ProviderType, ProviderConfig } from '../types';
import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GoogleProvider } from './GoogleProvider';
import { OllamaProvider } from './OllamaProvider';

/**
 * Manages provider instances and their configurations
 */
export class ProviderManager {
    private providers: Map<string, BaseProvider> = new Map();
    private configs: Partial<Record<ProviderType, ProviderConfig>>;

    constructor(configs: Partial<Record<ProviderType, ProviderConfig>>) {
        this.configs = configs;
    }

    /**
     * Initialize all providers with their configurations
     */
    async initialize(): Promise<void> {
        // Initialize OpenAI provider if API key is available and config exists
        if (this.configs[ProviderType.OPENAI]?.apiKey) {
            this.providers.set(
                ProviderType.OPENAI,
                new OpenAIProvider(
                    this.configs[ProviderType.OPENAI]!.apiKey!,
                    this.configs[ProviderType.OPENAI]!.defaultModel
                )
            );
        }

        // Initialize Anthropic provider if API key is available and config exists
        if (this.configs[ProviderType.ANTHROPIC]?.apiKey) {
            this.providers.set(
                ProviderType.ANTHROPIC,
                new AnthropicProvider(
                    this.configs[ProviderType.ANTHROPIC]!.apiKey!,
                    this.configs[ProviderType.ANTHROPIC]!.defaultModel
                )
            );
        }

        // Initialize Google/Gemini provider if API key is available
        if (this.configs[ProviderType.GEMINI]?.apiKey) {
            this.providers.set(
                ProviderType.GEMINI,
                new GoogleProvider(
                    this.configs[ProviderType.GEMINI]!.apiKey!,
                    this.configs[ProviderType.GEMINI]!.defaultModel
                )
            );
        }
        // Initialize Ollama provider if config exists
        if (this.configs[ProviderType.OLLAMA]) {
            this.providers.set(
                ProviderType.OLLAMA,
                new OllamaProvider(
                    '',  // No API key needed for local Ollama
                    this.configs[ProviderType.OLLAMA]!.defaultModel || 'llama2:3b'
                )
            );
        }
    }

    /**
     * Get a provider instance by type
     */
    getProvider(type: ProviderType): BaseProvider | undefined {
        return this.providers.get(type);
    }

    /**
     * Get all available providers
     */
    getProviders(): Map<string, BaseProvider> {
        return this.providers;
    }

    /**
     * Update a provider configuration
     */
    async updateProviderConfig(type: ProviderType, config: Partial<ProviderConfig>): Promise<void> {
        // Only update if the base config exists
        if (!this.configs[type]) return;
        this.configs[type] = {
            ...this.configs[type],
            ...config
        };

        // If the API key or defaultModel changed, reinitialize the provider
        if (config.apiKey || config.defaultModel) {
            // Remove existing provider
            this.providers.delete(type);

            // Create new provider with updated config if config exists
            if (this.configs[type]) {
                switch (type) {
                    case ProviderType.OPENAI:
                        if (this.configs[type]?.apiKey) {
                            this.providers.set(
                                type,
                                new OpenAIProvider(
                                    this.configs[type]!.apiKey!,
                                    this.configs[type]!.defaultModel
                                )
                            );
                        }
                        break;

                    case ProviderType.ANTHROPIC:
                        if (this.configs[type]?.apiKey) {
                            this.providers.set(
                                type,
                                new AnthropicProvider(
                                    this.configs[type]!.apiKey!,
                                    this.configs[type]!.defaultModel
                                )
                            );
                        }
                        break;

                    case ProviderType.GEMINI:
                        if (this.configs[type]?.apiKey) {
                            this.providers.set(
                                type,
                                new GoogleProvider(
                                    this.configs[type]!.apiKey!,
                                    this.configs[type]!.defaultModel
                                )
                            );
                        }
                        break;
                    case ProviderType.OLLAMA:
                        this.providers.set(
                            type,
                            new OllamaProvider(
                                '',
                                this.configs[type]!.defaultModel || 'llama2:3b'
                            )
                        );
                        break;
                }
            }
        }
    }

    /**
     * Check if a provider has been initialized
     */
    hasProvider(type: ProviderType): boolean {
        return this.providers.has(type);
    }

    /**
     * Validate API keys for all providers
     */
    async validateApiKeys(): Promise<Partial<Record<ProviderType, boolean>>> {
        const results: Partial<Record<ProviderType, boolean>> = {};

        // Check each provider
        for (const [type, provider] of this.providers.entries()) {
            try {
                results[type as ProviderType] = await provider.validateApiKey();
            } catch (error) {
                console.error(`Error validating API key for ${type}:`, error);
                results[type as ProviderType] = false;
            }
        }

        return results;
    }

    /**
     * Get available models for a provider
     */
    async getAvailableModels(type: ProviderType): Promise<string[]> {
        const provider = this.providers.get(type);

        if (!provider) {
            return this.configs[type]?.models || [];
        }

        try {
            return await provider.getAvailableModels();
        } catch (error) {
            console.error(`Error fetching models for ${type}:`, error);
            return this.configs[type]?.models || [];
        }
    }
} 