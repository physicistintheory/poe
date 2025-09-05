import { ProviderType, PluginConfig, ExpertAgentConfig, ModeratorConfig, ConversationSession, PanelConfig } from './types';
import { ProviderManager } from './providers/ProviderManager';
import { ConversationOrchestrator, setConversationOutputChannel } from './orchestration/ConversationOrchestrator';
import { PanelViewProvider, setOutputChannel } from './ui/PanelViewProvider';
import { setExpertAgentOutputChannel } from './agents/ExpertAgent';
import { setModeratorAgentOutputChannel } from './agents/ModeratorAgent';
import * as vscode from 'vscode';

// Default expert configurations
const DEFAULT_EXPERTS: ExpertAgentConfig[] = [
    {
        id: 'expert-1',
        name: 'Backend Engineer',
        provider: ProviderType.OLLAMA,
        model: 'llama3.2:1b',
        persona: `You are a veteran software engineer with extensive backend experience. 
    You focus on architectural decisions, code quality, and performance optimizations.
    You value reliable, scalable, and maintainable solutions over quick hacks.`,
        specialization: 'Backend architecture and system design',
        color: '#4285F4'
    },
    {
        id: 'expert-2',
        name: 'Creative Brainstormer',
        provider: ProviderType.OLLAMA,
        model: 'llama3.2:1b',
        persona: `You are an innovative thinker who excels at generating creative solutions.
    You think outside the box and challenge assumptions.
    You're skilled at finding unconventional approaches to problems.`,
        specialization: 'Creative problem-solving and ideation',
        color: '#EA4335'
    },
    {
        id: 'expert-3',
        name: 'Code Optimizer',
        provider: ProviderType.OLLAMA,
        model: 'llama3.2:1b',
        persona: `You are an efficiency-focused developer who specializes in optimizing code.
    You can spot inefficient patterns and suggest improvements.
    You balance readability with performance considerations.`,
        specialization: 'Performance optimization and refactoring',
        color: '#34A853'
    }
];

// Default moderator configuration
const DEFAULT_MODERATOR: ModeratorConfig = {
    id: 'moderator',
    name: 'Moderator',
    provider: ProviderType.OLLAMA,
    model: 'llama3.2:1b',
    systemPrompt: `As a discussion moderator, your job is to guide the conversation toward productive outcomes.
  Keep the experts focused on the user's question and prevent tangents.
  Summarize key points and ask clarifying questions when needed.`,
    interventionThreshold: 0.7
};

// Default plugin configuration
const DEFAULT_CONFIG: PluginConfig = {
    providers: {
        [ProviderType.OPENAI]: {
            type: ProviderType.OPENAI,
            defaultModel: '', // Will be populated dynamically
            models: [] // Will be populated dynamically
        },
        [ProviderType.ANTHROPIC]: {
            type: ProviderType.ANTHROPIC,
            defaultModel: '', // Will be populated dynamically
            models: [] // Will be populated dynamically
        },
        [ProviderType.GEMINI]: {
            type: ProviderType.GEMINI,
            apiKey: '',
            defaultModel: 'gemini-1.5-pro',
            models: []
        },
        [ProviderType.OLLAMA]: {
            type: ProviderType.OLLAMA,
            defaultModel: 'llama3.2:1b', // Force fast model
            models: [] // Will be populated dynamically
        }
    },
    defaultExperts: DEFAULT_EXPERTS,
    defaultModerator: DEFAULT_MODERATOR,
    maxConversationHistoryLength: 100,
    autoDiscussDefault: false
};

/**
 * Main plugin class for the POE (Panel of Experts) Cursor plugin
 */
export class PoePlugin {
    private config: PluginConfig;
    private providerManager: ProviderManager;
    private orchestrator?: ConversationOrchestrator;

    constructor(config: Partial<PluginConfig> = {}) {
        // Merge provided config with defaults
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            providers: {
                ...DEFAULT_CONFIG.providers,
                ...(config.providers || {})
            }
        };

        // Debug: Show the final configuration
        console.log('PoePlugin: Final configuration:', {
            ollamaDefaultModel: this.config.providers[ProviderType.OLLAMA]?.defaultModel,
            ollamaModels: this.config.providers[ProviderType.OLLAMA]?.models
        });

        // Try to get API keys from Cursor settings
        this.loadApiKeysFromSettings();

        // Initialize provider manager
        this.providerManager = new ProviderManager(this.config.providers);
    }

    /**
     * Load API keys from Cursor settings
     */
    private loadApiKeysFromSettings(): void {
        try {
            // Get API keys from Cursor settings (using the keys defined in package.json)
            const openaiKey = vscode.workspace.getConfiguration('poe').get('openaiApiKey') as string;
            const anthropicKey = vscode.workspace.getConfiguration('poe').get('anthropicApiKey') as string;
            const googleKey = vscode.workspace.getConfiguration('poe').get('geminiApiKey') as string;

            // Update provider configs with API keys, only if provider exists
            if (openaiKey && this.config.providers[ProviderType.OPENAI]) {
                this.config.providers[ProviderType.OPENAI]!.apiKey = openaiKey;
            }
            
            if (anthropicKey && this.config.providers[ProviderType.ANTHROPIC]) {
                this.config.providers[ProviderType.ANTHROPIC]!.apiKey = anthropicKey;
            }
            
            if (googleKey && this.config.providers[ProviderType.GEMINI]) {
                this.config.providers[ProviderType.GEMINI]!.apiKey = googleKey;
            }

            console.log('Loaded API keys from settings:', {
                openai: openaiKey ? '✓' : '✗',
                anthropic: anthropicKey ? '✓' : '✗',
                google: googleKey ? '✓' : '✗'
            });
        } catch (error) {
            console.error('Error loading API keys from settings:', error);
        }
    }

    /**
     * Initialize the plugin
     */
    async initialize(): Promise<void> {
        // Initialize providers
        await this.providerManager.initialize();

        console.log('Initializing provider manager...');

        // Populate available models (do not change configured defaults)
        await this.populateModelsAndSetDefaults();

        // Don't create an initial conversation - let the user start one with their selected panel
        // This prevents hardcoded defaults from being used before panel selection
        if (outputChannel) {
            outputChannel.appendLine('Plugin initialized - no initial conversation created');
        }
        
        // Create conversation orchestrator with default experts and moderator
        // try {
        //     console.log('Creating initial conversation...');
        //     this.createNewConversation({
        //         title: 'New Discussion',
        //         goal: ''
        //     });
        //     console.log('Initial conversation created successfully');
        // } catch (error) {
        //     console.error('Error creating initial conversation:', error);
        // }
    }

    /**
     * Populate available models from providers without changing configured defaults
     */
    private async populateModelsAndSetDefaults(): Promise<void> {
        try {
            // Get available models from each provider
            const providers = this.providerManager.getProviders();
            
            for (const [providerType, provider] of providers) {
                try {
                    const models = await provider.getAvailableModels();
                    console.log(`Models for ${providerType}:`, models);
                    if (models.length > 0) {
                        // Update the config with available models
                        const providerConfig = this.config.providers[providerType as ProviderType];
                        if (providerConfig) {
                            providerConfig.models = models;
                        }
                        
                        // Log the final model selection (but don't override our hardcoded choice)
                        if (providerConfig && providerConfig.defaultModel) {
                            console.log(`Provider ${providerType} using model: ${providerConfig.defaultModel}`);
                        } else {
                            console.warn(`Provider ${providerType} has no default model set`);
                        }
                        
                        console.log(`Successfully loaded ${models.length} models for ${providerType}: ${models.join(', ')}`);
                    } else {
                        console.warn(`No models available for provider ${providerType}`);
                    }
                } catch (error) {
                    console.warn(`Failed to fetch models for provider ${providerType}:`, error);
                }
            }

            console.log('Models populated and defaults set successfully');
        } catch (error) {
            console.error('Error populating models and setting defaults:', error);
        }
    }

    /**
     * Create a new conversation with given settings
     */
    createNewConversation(settings: {
        title: string;
        goal: string;
        experts?: ExpertAgentConfig[];
        moderator?: ModeratorConfig;
        autoDiscuss?: boolean;
    }): void {
        console.log('Creating new conversation with settings:', settings.title);
        const experts = settings.experts || this.config.defaultExperts;
        const moderator = settings.moderator || this.config.defaultModerator;

        // Always resolve models from provider defaults, ignoring any stored model values
        const resolvedExperts = experts.map(expert => {
            const providerDefault = this.config.providers[expert.provider]?.defaultModel;
            const finalModel = providerDefault || expert.model || (expert.provider === ProviderType.OLLAMA ? 'llama3.2:1b' : '');
            if (outputChannel) {
                outputChannel.appendLine(`Model override: Expert ${expert.name} -> ${finalModel}`);
            }
            return { ...expert, model: finalModel };
        });
        const moderatorProviderDefault = this.config.providers[moderator.provider]?.defaultModel;
        const resolvedModerator = { ...moderator, model: moderatorProviderDefault || moderator.model || (moderator.provider === ProviderType.OLLAMA ? 'llama3.2:1b' : '') };
        if (outputChannel) {
            outputChannel.appendLine(`Model override: Moderator ${resolvedModerator.name} -> ${resolvedModerator.model}`);
        }

        if (outputChannel) {
            outputChannel.appendLine(`createNewConversation - settings.experts provided: ${settings.experts ? 'YES' : 'NO'}`);
            outputChannel.appendLine(`createNewConversation - settings.moderator provided: ${settings.moderator ? 'YES' : 'NO'}`);
            outputChannel.appendLine(`createNewConversation - final experts: ${experts.map(e => e.name).join(', ')}`);
            outputChannel.appendLine(`createNewConversation - final moderator: ${moderator.name}`);
        }

        try {
            const providers = this.providerManager.getProviders();
            console.log(`Got ${providers.size} providers for conversation`);
            
            this.orchestrator = new ConversationOrchestrator(
                {
                    title: settings.title,
                    goal: settings.goal,
                    autoDiscuss: settings.autoDiscuss ?? this.config.autoDiscussDefault
                },
                resolvedExperts,
                resolvedModerator,
                providers,
                this.config.maxConversationHistoryLength,
            );
            
            console.log('Created new conversation orchestrator successfully');
        } catch (error) {
            console.error('Error creating conversation orchestrator:', error);
            throw error; // Re-throw to handle at caller level
        }
    }

    /**
     * Force refresh all providers to ensure new configuration takes effect
     */
    async forceRefreshProviders(): Promise<void> {
        console.log('PoePlugin: Force refreshing providers...');
        await this.providerManager.forceRefreshProviders();
        console.log('PoePlugin: Providers refreshed successfully');
    }

    /**
     * Force set the Ollama model for all providers
     */
    public forceSetOllamaModel(model: string): void {
        console.log(`Force setting Ollama model to: ${model}`);
        
        // Update the config
        if (this.config.providers[ProviderType.OLLAMA]) {
            this.config.providers[ProviderType.OLLAMA].defaultModel = model;
        }
        
        // Force refresh all providers
        this.providerManager.forceRefreshProviders();
        
        console.log(`Ollama model forced to: ${model}`);
    }

    /**
     * Force refresh panel models to use correct default models
     */
    public forceRefreshPanelModels(): void {
        console.log('Force refreshing panel models...');
        
        // Force refresh providers
        this.providerManager.forceRefreshProviders();
        
        console.log('Panel models refresh initiated');
    }

    /**
     * Get the current Ollama default model
     */
    public getOllamaDefaultModel(): string {
        return this.config.providers[ProviderType.OLLAMA]?.defaultModel || 'none';
    }

    /**
     * Get available Ollama models
     */
    public getAvailableOllamaModels(): string[] {
        return this.config.providers[ProviderType.OLLAMA]?.models || [];
    }

    /**
     * Get the conversation orchestrator
     */
    getOrchestrator(): ConversationOrchestrator | undefined {
        return this.orchestrator;
    }

    /**
     * Get the provider manager
     */
    getProviderManager(): ProviderManager {
        return this.providerManager;
    }

    /**
     * Update plugin configuration
     */
    async updateConfig(newConfig: Partial<PluginConfig>): Promise<void> {
        // Update providers if needed
        if (newConfig.providers) {
            for (const [type, config] of Object.entries(newConfig.providers)) {
                await this.providerManager.updateProviderConfig(type as ProviderType, config);
            }
        }

        // Update other config properties
        this.config = {
            ...this.config,
            ...newConfig,
            providers: {
                ...this.config.providers,
                ...(newConfig.providers || {})
            }
        };
    }

    /**
     * Start a new panel discussion
     */
    startPanelDiscussion(panelConfig?: PanelConfig): void {
        vscode.window.showInformationMessage('Starting Panel of Experts Discussion');
        
        if (outputChannel) {
            outputChannel.appendLine(`startPanelDiscussion called with panel: ${panelConfig ? panelConfig.name : 'undefined'}`);
            if (panelConfig) {
                outputChannel.appendLine(`Panel experts: ${panelConfig.experts.map(e => e.name).join(', ')}`);
                outputChannel.appendLine(`Panel moderator: ${panelConfig.moderator.name}`);
            } else {
                outputChannel.appendLine('No panel config provided, will use defaults');
            }
        }
        
        // Create a new conversation with a more descriptive title
        const sessionTitle = `Discussion ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}`;
        
        // Use panel config if provided, otherwise fall back to defaults
        const experts = panelConfig?.experts || this.config.defaultExperts;
        const moderator = panelConfig?.moderator || this.config.defaultModerator;
        
        if (outputChannel) {
            outputChannel.appendLine(`Using experts: ${experts.map(e => e.name).join(', ')}`);
            outputChannel.appendLine(`Using moderator: ${moderator.name}`);
        }
        
        this.createNewConversation({
            title: sessionTitle,
            goal: panelConfig?.description || 'New discussion started via command',
            experts: experts,
            moderator: moderator
        });
    }

    /**
     * Toggle auto-discussion mode
     */
    toggleAutoDiscuss(): void {
        if (!this.orchestrator) {
            vscode.window.showErrorMessage('No active discussion. Start a panel first.');
            return;
        }
        
        const currentState = this.orchestrator.isAutoDiscussEnabled();
        this.orchestrator.setAutoDiscuss(!currentState);
        vscode.window.showInformationMessage(`Auto-discussion mode: ${!currentState ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Reset the current conversation
     */
    resetConversation(panelConfig?: PanelConfig): void {
        // Create a new conversation with a unique title
        const resetTitle = `Reset Discussion ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}`;
        
        // Use panel config if provided, otherwise fall back to defaults
        const experts = panelConfig?.experts || this.config.defaultExperts;
        const moderator = panelConfig?.moderator || this.config.defaultModerator;
        
        this.createNewConversation({
            title: resetTitle,
            goal: panelConfig?.description || 'Fresh discussion after reset',
            experts: experts,
            moderator: moderator
        });
        
        vscode.window.showInformationMessage('Conversation has been reset');
    }
}

// Plugin singleton instance
let pluginInstance: PoePlugin | undefined;
let panelViewProvider: PanelViewProvider | undefined;
let outputChannel: vscode.OutputChannel;

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext): void {
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('Panel of Experts');
    context.subscriptions.push(outputChannel);
    
    // Pass the output channel to the PanelViewProvider
    setOutputChannel(outputChannel);
    setConversationOutputChannel(outputChannel);
    setExpertAgentOutputChannel(outputChannel);
    setModeratorAgentOutputChannel(outputChannel);
    
    outputChannel.appendLine('Activating Panel of Experts plugin');
    
    // Create plugin instance
    pluginInstance = new PoePlugin();
    
    // Create and register the panel view provider
    outputChannel.appendLine('Creating and registering panel view provider...');
    panelViewProvider = new PanelViewProvider(context.extensionUri, context);
    
    const panelView = vscode.window.registerWebviewViewProvider(
        'poe-panel',
        panelViewProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }
    );
    context.subscriptions.push(panelView);
    outputChannel.appendLine('Panel view provider registered with ID: poe-panel');

    // Initialize the plugin after providers are registered
    pluginInstance.initialize().then(() => {
        outputChannel.appendLine('Plugin initialized, orchestrator will be set when view is ready');
        
        // Try to set the orchestrator immediately if it's already available
        if (pluginInstance && pluginInstance.getOrchestrator() && panelViewProvider) {
            outputChannel.appendLine('Setting initial orchestrator on panel view');
            panelViewProvider.setOrchestrator(pluginInstance.getOrchestrator());
        }
        
        // Also register for view ready event to ensure orchestrator is set
        if (panelViewProvider) {
            panelViewProvider.onViewReady(() => {
                outputChannel.appendLine('Panel view is ready, setting orchestrator if available');
                if (pluginInstance) {
                    const orchestrator = pluginInstance.getOrchestrator();
                    if (orchestrator) {
                        outputChannel.appendLine('Setting orchestrator on panel view now that view is ready');
                        if (panelViewProvider) {
                            panelViewProvider.setOrchestrator(orchestrator);
                        }
                    } else {
                        outputChannel.appendLine('No orchestrator available when view became ready');
                        // Start a panel to ensure we have an orchestrator
                        vscode.commands.executeCommand('poe.startPanel');
                    }
                }
            });
        }
    }).catch(err => {
        outputChannel.appendLine('Failed to initialize POE plugin: ' + err);
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('poe.startPanel', () => {
            if (pluginInstance && panelViewProvider) {
                // Get the currently selected panel from the panel view provider
                const currentPanel = panelViewProvider.getCurrentPanel();
                outputChannel.appendLine(`Starting panel discussion with panel: ${currentPanel?.name || 'default'}`);
                
                pluginInstance.startPanelDiscussion(currentPanel);
                
                // Update the panel view provider with the new orchestrator
                if (pluginInstance.getOrchestrator()) {
                    outputChannel.appendLine('Updating panel view provider with new orchestrator after startPanel command');
                    panelViewProvider.setOrchestrator(pluginInstance.getOrchestrator());
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('poe.toggleAutoDiscuss', () => {
            if (pluginInstance) {
                pluginInstance.toggleAutoDiscuss();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('poe.resetConversation', () => {
            if (pluginInstance && panelViewProvider) {
                // Get the currently selected panel from the panel view provider
                const currentPanel = panelViewProvider.getCurrentPanel();
                outputChannel.appendLine(`Resetting conversation with panel: ${currentPanel?.name || 'default'}`);
                
                pluginInstance.resetConversation(currentPanel);
                
                // Update the panel view provider with the new orchestrator
                if (pluginInstance.getOrchestrator()) {
                    outputChannel.appendLine('Updating panel view provider with new orchestrator after resetConversation command');
                    panelViewProvider.setOrchestrator(pluginInstance.getOrchestrator());
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('poe.forceRefreshProviders', () => {
            if (pluginInstance) {
                outputChannel.appendLine('Force refreshing providers to use new model configuration...');
                pluginInstance.forceRefreshProviders().then(() => {
                    outputChannel.appendLine('Providers refreshed successfully. New model configuration should now be active.');
                }).catch(error => {
                    outputChannel.appendLine(`Error refreshing providers: ${error}`);
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('poe.forceSetOllamaModel', () => {
            if (pluginInstance) {
                outputChannel.appendLine('Force setting Ollama model to llama3.2:1b for fast responses...');
                pluginInstance.forceSetOllamaModel('llama3.2:1b');
                outputChannel.appendLine('Ollama model forced to llama3.2:1b. New conversations should be fast.');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('poe.clearPanelStorage', () => {
            if (pluginInstance) {
                outputChannel.appendLine('Clearing stored panel configurations to force new model selection...');
                // Clear the stored panels from VS Code global state
                context.globalState.update('poe.panels', undefined);
                outputChannel.appendLine('Panel storage cleared. Restart the extension to use new default models.');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('poe.forceRefreshModels', () => {
            if (pluginInstance) {
                outputChannel.appendLine('Force refreshing all models and providers...');
                pluginInstance.forceRefreshPanelModels();
                outputChannel.appendLine('Models refreshed. New conversations should use correct default models.');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('poe.showCurrentModels', () => {
            if (pluginInstance) {
                outputChannel.appendLine('=== Current Model Configuration ===');
                outputChannel.appendLine(`Ollama Default: ${pluginInstance.getOllamaDefaultModel()}`);
                outputChannel.appendLine(`Available Ollama Models: ${pluginInstance.getAvailableOllamaModels().join(', ')}`);
                outputChannel.appendLine('===============================');
            }
        })
    );

    // Register a command to switch between sessions
    context.subscriptions.push(
        vscode.commands.registerCommand('poe.switchSession', (session) => {
            if (pluginInstance && session) {
                outputChannel.appendLine(`Switching to session: ${session.id}`);
                
                // Create a new conversation with the selected session's properties
                pluginInstance.createNewConversation({
                    title: session.title,
                    goal: session.goal
                });
                
                // Update the panel view provider with the new orchestrator
                if (pluginInstance.getOrchestrator() && panelViewProvider) {
                    outputChannel.appendLine('Updating panel view provider with orchestrator after switching session');
                    panelViewProvider.setOrchestrator(pluginInstance.getOrchestrator());
                }
            }
        })
    );

    // Try to show the panel view when activated
    // First show the view container in the activity bar
    outputChannel.appendLine('Attempting to show the Panel of Experts view container');
    
    // Use a function to make multiple attempts to show the view
    const attemptToShowPanel = (attempt = 1) => {
        outputChannel.appendLine(`Attempt ${attempt} to show panel view`);
        
        // First try to activate the view container
        vscode.commands.executeCommand('workbench.view.extension.poe-container')
            .then(() => {
                outputChannel.appendLine('Successfully focused the Panel of Experts view container');
                
                // Give a little time for the view container to initialize
                setTimeout(() => {
                    // Focus the panel view
                    vscode.commands.executeCommand('poe-panel.focus')
                        .then(() => {
                            outputChannel.appendLine('Successfully focused the Panel of Experts panel view');
                            
                            // Start a panel discussion if this is the first attempt
                            if (attempt === 1) {
                                setTimeout(() => {
                                    vscode.commands.executeCommand('poe.startPanel')
                                        .then(() => {
                                            outputChannel.appendLine('Started Panel of Experts discussion');
                                        })
                                        .then(undefined, (error: Error) => {
                                            outputChannel.appendLine('Error starting discussion: ' + error.message);
                                        });
                                }, 1000);
                            }
                        })
                        .then(undefined, (error: Error) => {
                            outputChannel.appendLine('Error focusing panel view: ' + error.message);
                            
                            // If we failed to focus and we haven't tried too many times, try again
                            if (attempt < 3) {
                                setTimeout(() => attemptToShowPanel(attempt + 1), 2000 * attempt);
                            }
                        });
                }, 500);
            })
            .then(undefined, (error: Error) => {
                outputChannel.appendLine('Error focusing view container: ' + error.message);
                
                // Try showing just the panel view directly
                vscode.commands.executeCommand('poe-panel.focus')
                    .then(undefined, (error2: Error) => {
                        outputChannel.appendLine('Error focusing panel view directly: ' + error2.message);
                        
                        // If we failed on both approaches and haven't tried too many times, try again
                        if (attempt < 3) {
                            setTimeout(() => attemptToShowPanel(attempt + 1), 2000 * attempt);
                        }
                    });
            });
    };
    
    // Start the first attempt after a short delay to allow extension to initialize
    setTimeout(() => attemptToShowPanel(), 1500);
    
    outputChannel.appendLine('Panel of Experts plugin activated');
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
    if (outputChannel) {
        outputChannel.appendLine('Panel of Experts plugin deactivated');
    }
    pluginInstance = undefined;
}

// Export plugin factory function for Cursor
export default function createPoePlugin(config?: Partial<PluginConfig>): PoePlugin {
    const plugin = new PoePlugin(config);
    // Initialize asynchronously and ignore the promise
    // Cursor will handle this appropriately
    plugin.initialize();
    return plugin;
} 