// LLM Provider types
export enum ProviderType {
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GOOGLE = 'google',
    OLLAMA = 'ollama'
}

// Agent role types
export enum AgentRole {
    EXPERT = 'expert',
    MODERATOR = 'moderator',
    USER = 'user'
}

// Message structure for the conversation
export interface Message {
    id: string;
    sender: {
        id: string;
        name: string;
        role: AgentRole;
        provider?: ProviderType;
    };
    content: string;
    timestamp: number;
    replyTo?: string; // ID of message this is replying to
    isStreaming?: boolean; // Whether this message is currently being streamed
}

// Expert agent configuration
export interface ExpertAgentConfig {
    id: string;
    name: string;
    provider: ProviderType;
    model: string;
    persona: string; // The system prompt defining this expert's role/persona
    specialization: string; // One-line description of what this expert specializes in
    avatarUrl?: string; // Optional URL to an avatar image
    color?: string; // Optional color code for UI
    temperature?: number; // Temperature setting for this expert (0.0-2.0)
    maxTokens?: number; // Maximum tokens for this expert's responses
}

// Moderator agent configuration
export interface ModeratorConfig {
    id: string;
    name: string;
    provider: ProviderType;
    model: string;
    systemPrompt: string; // The instructions for how to moderate
    interventionThreshold?: number; // When to intervene (0-1 scale)
}

// Conversation session
export interface ConversationSession {
    id: string;
    title: string;
    goal: string; // The main objective/question of this conversation
    created: number;
    updated: number;
    messages: Message[];
    experts: ExpertAgentConfig[];
    moderator: ModeratorConfig;
    isActive: boolean; // Whether this conversation is currently running
    autoDiscuss: boolean; // Whether to auto-continue discussion
    maxTurns?: number; // Maximum number of turns before auto-stopping
}

// Provider API configuration
export interface ProviderConfig {
    type: ProviderType;
    apiKey?: string;
    defaultModel: string;
    models: string[]; // Available models for this provider
}

// Plugin configuration
export interface PluginConfig {
    providers: Partial<Record<ProviderType, ProviderConfig>>;
    defaultExperts: ExpertAgentConfig[];
    defaultModerator: ModeratorConfig;
    maxConversationHistoryLength: number;
    autoDiscussDefault: boolean;
}

// Response from an LLM
export interface LLMResponse {
    content: string;
    model?: string;
    provider?: ProviderType;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// Status of the conversation for UI
export enum ConversationStatus {
    IDLE = 'idle',
    WAITING_USER = 'waiting_user',
    PROCESSING = 'processing',
    ERROR = 'error'
}

// Panel configuration - a reusable set of experts and moderator
export interface PanelConfig {
    id: string;
    name: string;
    description: string;
    experts: ExpertAgentConfig[];
    moderator: ModeratorConfig;
    created?: number;
    updated?: number;
} 