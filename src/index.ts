import { ProviderType, PluginConfig, ExpertAgentConfig, ModeratorConfig } from './types';
import { ProviderManager } from './providers/ProviderManager';
import { ConversationOrchestrator } from './orchestration/ConversationOrchestrator';
import * as vscode from 'vscode';
import { SessionsTreeDataProvider, SessionTreeItem } from './ui/SessionsTreeDataProvider';
import { PanelViewProvider } from './ui/PanelViewProvider';

// Default expert configurations
const DEFAULT_EXPERTS: ExpertAgentConfig[] = [
    {
        id: 'expert-1',
        name: 'Backend Engineer',
        provider: ProviderType.OPENAI,
        model: 'gpt-4',
        persona: `You are a veteran software engineer with extensive backend experience. 
    You focus on architectural decisions, code quality, and performance optimizations.
    You value reliable, scalable, and maintainable solutions over quick hacks.`,
        specialization: 'Backend architecture and system design',
        color: '#4285F4'
    },
    {
        id: 'expert-2',
        name: 'Creative Brainstormer',
        provider: ProviderType.ANTHROPIC,
        model: 'claude-2',
        persona: `You are an innovative thinker who excels at generating creative solutions.
    You think outside the box and challenge assumptions.
    You're skilled at finding unconventional approaches to problems.`,
        specialization: 'Creative problem-solving and ideation',
        color: '#EA4335'
    },
    {
        id: 'expert-3',
        name: 'Code Optimizer',
        provider: ProviderType.OPENAI,
        model: 'gpt-3.5-turbo',
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
    provider: ProviderType.OPENAI,
    model: 'gpt-4',
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
            defaultModel: 'gpt-4',
            models: ['gpt-4', 'gpt-3.5-turbo']
        },
        [ProviderType.ANTHROPIC]: {
            type: ProviderType.ANTHROPIC,
            defaultModel: 'claude-2',
            models: ['claude-2', 'claude-instant-1']
        },
        [ProviderType.GOOGLE]: {
            type: ProviderType.GOOGLE,
            defaultModel: 'gemini-1.5-pro',
            models: ['gemini-1.5-pro', 'gemini-1.0-pro']
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
            // Get API keys from Cursor settings
            const openaiKey = vscode.workspace.getConfiguration('poe.apiKeys').get('openai') as string;
            const anthropicKey = vscode.workspace.getConfiguration('poe.apiKeys').get('anthropic') as string;
            const googleKey = vscode.workspace.getConfiguration('poe.apiKeys').get('google') as string;

            // Update provider configs with API keys
            if (openaiKey) {
                this.config.providers[ProviderType.OPENAI].apiKey = openaiKey;
            }
            
            if (anthropicKey) {
                this.config.providers[ProviderType.ANTHROPIC].apiKey = anthropicKey;
            }
            
            if (googleKey) {
                this.config.providers[ProviderType.GOOGLE].apiKey = googleKey;
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

        // Create conversation orchestrator with default experts and moderator
        try {
            console.log('Creating initial conversation...');
            this.createNewConversation({
                title: 'New Discussion',
                goal: ''
            });
            console.log('Initial conversation created successfully');
        } catch (error) {
            console.error('Error creating initial conversation:', error);
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

        try {
            const providers = this.providerManager.getProviders();
            console.log(`Got ${providers.size} providers for conversation`);
            
            this.orchestrator = new ConversationOrchestrator(
                {
                    title: settings.title,
                    goal: settings.goal,
                    autoDiscuss: settings.autoDiscuss ?? this.config.autoDiscussDefault
                },
                experts,
                moderator,
                providers,
                this.config.maxConversationHistoryLength
            );
            
            console.log('Created new conversation orchestrator successfully');
        } catch (error) {
            console.error('Error creating conversation orchestrator:', error);
            throw error; // Re-throw to handle at caller level
        }
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
    startPanelDiscussion(): void {
        vscode.window.showInformationMessage('Starting Panel of Experts Discussion');
        
        // Create a new conversation with a more descriptive title
        const sessionTitle = `Discussion ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}`;
        
        this.createNewConversation({
            title: sessionTitle,
            goal: 'New discussion started via command'
        });
        
        // Make sure to add the new session to the tree view
        if (this.orchestrator && sessionsProvider) {
            const session = this.orchestrator.getSession();
            sessionsProvider.addSession(session);
            
            // Log to console for debugging
            console.log('Added new session to tree view:', session.id);
        } else {
            console.error('Failed to add session to tree view - orchestrator or sessionsProvider not available');
        }
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
    resetConversation(): void {
        // Create a new conversation with a unique title
        const resetTitle = `Reset Discussion ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}`;
        
        this.createNewConversation({
            title: resetTitle,
            goal: 'Fresh discussion after reset'
        });
        
        vscode.window.showInformationMessage('Conversation has been reset');
        
        // Update the session in the tree view
        if (this.orchestrator && sessionsProvider) {
            const session = this.orchestrator.getSession();
            if (session) {
                // Add as a new session rather than replacing existing ones
                sessionsProvider.addSession(session);
                console.log('Added reset session to tree view:', session.id);
            }
        } else {
            console.error('Failed to update session in tree view after reset');
        }
    }
}

// Plugin singleton instance
let pluginInstance: PoePlugin | undefined;
let sessionsProvider: SessionsTreeDataProvider | undefined;
let panelViewProvider: PanelViewProvider | undefined;

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('Activating Panel of Experts plugin');
    
    // Create plugin instance
    pluginInstance = new PoePlugin();
    
    // Create and register the panel view provider first
    console.log('Creating and registering panel view provider...');
    panelViewProvider = new PanelViewProvider(context.extensionUri);
    const panelView = vscode.window.registerWebviewViewProvider(
        'poe-panel',
        panelViewProvider
    );
    context.subscriptions.push(panelView);
    console.log('Panel view provider registered with ID: poe-panel');

    // Create and register the sessions tree data provider
    console.log('Creating and registering sessions tree data provider...');
    sessionsProvider = new SessionsTreeDataProvider();
    const sessionsTreeView = vscode.window.createTreeView('poe-sessions', {
        treeDataProvider: sessionsProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(sessionsTreeView);
    console.log('Sessions tree view registered with ID: poe-sessions');

    // Initialize the plugin after providers are registered
    pluginInstance.initialize().then(() => {
        console.log('Plugin initialized, setting orchestrator on panel view provider');
        
        // Set the orchestrator on the panel view provider
        if (pluginInstance && panelViewProvider) {
            const orchestrator = pluginInstance.getOrchestrator();
            if (orchestrator) {
                console.log('Setting orchestrator on panel view provider');
                panelViewProvider.setOrchestrator(orchestrator);
                
                // Add the current session to the tree view
                if (sessionsProvider) {
                    const session = orchestrator.getSession();
                    console.log('Adding initial session to tree view:', session.id);
                    sessionsProvider.addSession(session);
                }
            } else {
                console.error('No orchestrator available after plugin initialization');
            }
        }
    }).catch(err => {
        console.error('Failed to initialize POE plugin:', err);
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('poe.startPanel', () => {
            if (pluginInstance) {
                pluginInstance.startPanelDiscussion();
                
                // Update the panel view provider with the new orchestrator
                if (pluginInstance.getOrchestrator() && panelViewProvider) {
                    console.log('Updating panel view provider with new orchestrator after startPanel command');
                    panelViewProvider.setOrchestrator(pluginInstance.getOrchestrator());
                }
                
                // Add the session to the tree view
                if (pluginInstance.getOrchestrator() && sessionsProvider) {
                    const session = pluginInstance.getOrchestrator()?.getSession();
                    if (session) {
                        sessionsProvider.addSession(session);
                    }
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
            if (pluginInstance) {
                pluginInstance.resetConversation();
                
                // Update the panel view provider with the new orchestrator
                if (pluginInstance.getOrchestrator() && panelViewProvider) {
                    console.log('Updating panel view provider with new orchestrator after resetConversation command');
                    panelViewProvider.setOrchestrator(pluginInstance.getOrchestrator());
                }
                
                // Update the session in the tree view
                if (pluginInstance.getOrchestrator() && sessionsProvider) {
                    const session = pluginInstance.getOrchestrator()?.getSession();
                    if (session) {
                        // Add as a new session rather than replacing existing ones
                        sessionsProvider.addSession(session);
                    }
                }
            }
        })
    );

    console.log('Panel of Experts plugin activated');
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
    console.log('Panel of Experts plugin deactivated');
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