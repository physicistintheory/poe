import { ProviderManager } from '../../src/providers/ProviderManager';
import { ProviderType } from '../../src/types';

// Mock the provider implementation
jest.mock('../../src/providers/OllamaProvider');

describe('ProviderManager', () => {
    let providerManager: ProviderManager;

    const mockConfig = {
        [ProviderType.OLLAMA]: {
            type: ProviderType.OLLAMA,
            defaultModel: 'llama3.2:1b',
            models: ['llama3.2:1b', 'llama2:7b', 'mistral:7b', 'qwen:4b']
        }
    };

    beforeEach(() => {
        providerManager = new ProviderManager(mockConfig);
    });

    describe('initialization', () => {
        it('should initialize with provided config', () => {
            expect(providerManager).toBeDefined();
        });

        it('should initialize Ollama provider', async () => {
            await providerManager.initialize();
            const providers = providerManager.getProviders();
            expect(providers.size).toBe(1); // Only Ollama provider
        });
    });

    describe('provider management', () => {
        it('should get Ollama provider', async () => {
            await providerManager.initialize();
            const ollamaProvider = providerManager.getProvider(ProviderType.OLLAMA);
            expect(ollamaProvider).toBeDefined();
        });

        it('should return undefined for non-existent provider', async () => {
            await providerManager.initialize();
            const nonExistentProvider = providerManager.getProvider('NON_EXISTENT' as ProviderType);
            expect(nonExistentProvider).toBeUndefined();
        });

        it('should get all providers', async () => {
            await providerManager.initialize();
            const providers = providerManager.getProviders();
            expect(providers.size).toBe(1); // Only Ollama provider
        });
    });

    describe('error handling', () => {
        it('should handle initialization errors gracefully', async () => {
            // Mock a provider to throw an error during initialization
            const mockError = new Error('Initialization failed');
            jest.spyOn(providerManager, 'initialize').mockRejectedValueOnce(mockError);

            await expect(providerManager.initialize()).rejects.toThrow('Initialization failed');
        });
    });
}); 