import { PoePlugin } from '../../src/index';
import { ProviderType, PluginConfig } from '../../src/types';
import { ProviderManager } from '../../src/providers/ProviderManager';
import { ConversationOrchestrator } from '../../src/orchestration/ConversationOrchestrator';

// Mock dependencies
jest.mock('../../src/providers/ProviderManager');
jest.mock('../../src/orchestration/ConversationOrchestrator');
jest.mock('vscode');

describe('PoePlugin', () => {
    let plugin: PoePlugin;
    let mockProviderManager: jest.Mocked<ProviderManager>;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        
        // Create a new plugin instance with minimal config
        plugin = new PoePlugin({
            providers: {
                [ProviderType.OLLAMA]: {
                    type: ProviderType.OLLAMA,
                    defaultModel: 'llama2:3b',
                    models: ['llama2:3b', 'llama2:7b', 'mistral:7b', 'llama3.2:1b']
                }
            }
        });
        
        mockProviderManager = ProviderManager.prototype as jest.Mocked<ProviderManager>;
        // Mock getProviders to return a Map
        mockProviderManager.getProviders = jest.fn().mockReturnValue(new Map([[ProviderType.OLLAMA, {} as any]]));
    });

    describe('initialization', () => {
        it('should initialize with default config when no config is provided', () => {
            const defaultPlugin = new PoePlugin();
            expect(defaultPlugin).toBeDefined();
        });

        it('should merge provided config with defaults', () => {
            const customConfig: Partial<PluginConfig> = {
                maxConversationHistoryLength: 50,
                autoDiscussDefault: true
            };
            
            const customPlugin = new PoePlugin(customConfig);
            expect(customPlugin).toBeDefined();
        });
    });

    describe('conversation management', () => {
        it('should create a new conversation with provided settings', () => {
            const settings = {
                title: 'Test Discussion',
                goal: 'Test goal'
            };

            plugin.createNewConversation(settings);
            expect(ConversationOrchestrator).toHaveBeenCalled();
        });

        it('should use default experts and moderator when not provided', () => {
            const settings = {
                title: 'Test Discussion',
                goal: 'Test goal'
            };

            plugin.createNewConversation(settings);
            expect(ConversationOrchestrator).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: settings.title,
                    goal: settings.goal
                }),
                expect.any(Array),
                expect.any(Object),
                expect.any(Map),
                expect.any(Number)
            );
        });
    });

    describe('provider management', () => {
        it('should initialize provider manager on plugin initialization', async () => {
            await plugin.initialize();
            expect(mockProviderManager.initialize).toHaveBeenCalled();
        });

        it('should get provider manager instance', () => {
            const providerManager = plugin.getProviderManager();
            expect(providerManager).toBeDefined();
        });
    });
}); 