import { ProviderType, PluginConfig, ExpertAgentConfig, ModeratorConfig } from './types';
import { ProviderManager } from './providers/ProviderManager';
import { ConversationOrchestrator } from './orchestration/ConversationOrchestrator';

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

        // Initialize provider manager
        this.providerManager = new ProviderManager(this.config.providers);
    }

    /**
     * Initialize the plugin
     */
    async initialize(): Promise<void> {
        // Initialize providers
        await this.providerManager.initialize();

        // Create conversation orchestrator with default experts and moderator
        this.createNewConversation({
            title: 'New Discussion',
            goal: ''
        });
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
        const experts = settings.experts || this.config.defaultExperts;
        const moderator = settings.moderator || this.config.defaultModerator;

        this.orchestrator = new ConversationOrchestrator(
            {
                title: settings.title,
                goal: settings.goal,
                autoDiscuss: settings.autoDiscuss ?? this.config.autoDiscussDefault
            },
            experts,
            moderator,
            this.providerManager.getProviders(),
            this.config.maxConversationHistoryLength
        );
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
}

// Export plugin factory function for Cursor
export default function createPoePlugin(config?: Partial<PluginConfig>): PoePlugin {
    const plugin = new PoePlugin(config);
    // Initialize asynchronously and ignore the promise
    // Cursor will handle this appropriately
    plugin.initialize();
    return plugin;
} 