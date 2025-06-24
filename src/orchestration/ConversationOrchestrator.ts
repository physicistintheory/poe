import { v4 as uuidv4 } from 'uuid';
import {
    ConversationSession,
    Message,
    AgentRole,
    ExpertAgentConfig,
    ModeratorConfig,
    ConversationStatus
} from '../types';
import { ExpertAgent } from '../agents/ExpertAgent';
import { ModeratorAgent } from '../agents/ModeratorAgent';
import { BaseProvider } from '../providers/BaseProvider';
import * as vscode from 'vscode';
let outputChannel: vscode.OutputChannel;
export function setConversationOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel;
}

// Reference to the shared output channel
/**
 * Manages the conversation flow between multiple expert agents and a moderator
 */
export class ConversationOrchestrator {
    private session: ConversationSession;
    private experts: ExpertAgent[] = [];
    private moderator!: ModeratorAgent;
    private providerMap: Map<string, BaseProvider> = new Map();
    private status: ConversationStatus = ConversationStatus.IDLE;
    private maxTurns: number;
    private currentTurn: number = 0;
    private messageListeners: ((message: Message) => void)[] = [];
    private statusListeners: ((status: ConversationStatus) => void)[] = [];

    constructor(
        sessionConfig: Partial<ConversationSession>,
        experts: ExpertAgentConfig[],
        moderatorConfig: ModeratorConfig,
        providerMap: Map<string, BaseProvider>,
        maxTurns: number = 50
    ) {
        this.providerMap = providerMap;
        this.maxTurns = maxTurns;

        // Initialize the session
        this.session = {
            id: sessionConfig.id || uuidv4(),
            title: sessionConfig.title || 'New Discussion',
            goal: sessionConfig.goal || '',
            created: sessionConfig.created || Date.now(),
            updated: sessionConfig.updated || Date.now(),
            messages: sessionConfig.messages || [],
            experts: experts,
            moderator: moderatorConfig,
            isActive: false,
            autoDiscuss: sessionConfig.autoDiscuss || true, // default to true so discusssions can start after the first user utterance
            maxTurns: sessionConfig.maxTurns || this.maxTurns
        };

        // Initialize expert agents
        this.initializeExperts();

        // Initialize moderator agent
        this.initializeModerator();
    }

    /**
     * Initialize expert agents from configuration
     */
    private initializeExperts(): void {
        this.experts = this.session.experts.map(expertConfig => {
            const provider = this.providerMap.get(expertConfig.provider);

            if (!provider) {
                throw new Error(`Provider ${expertConfig.provider} not found for expert ${expertConfig.name}`);
            }
            outputChannel.appendLine(`Created expert2: ${expertConfig.name}`)
            return new ExpertAgent(expertConfig, provider);
        });
    }

    /**
     * Initialize moderator agent from configuration
     */
    private initializeModerator(): void {
        const provider = this.providerMap.get(this.session.moderator.provider);

        if (!provider) {
            throw new Error(`Provider ${this.session.moderator.provider} not found for moderator`);
        }

        this.moderator = new ModeratorAgent(this.session.moderator, provider);
        this.moderator.setGoal(this.session.goal);
    }

    /**
     * Add a user message to the conversation
     */
    async addUserMessage(content: string): Promise<void> {
        // Create a user message
        const message: Message = {
            id: uuidv4(),
            sender: {
                id: 'user',
                name: 'User',
                role: AgentRole.USER
            },
            content,
            timestamp: Date.now()
        };

        // Add to the session
        this.session.messages.push(message);

        // Update session timestamp
        this.session.updated = Date.now();

        // Notify listeners
        this.notifyMessageListeners(message);

        // If auto-discuss is enabled, start the next round
        outputChannel.appendLine(`KBUX message received, autodiscuss: ${this.session.autoDiscuss}`)
        if (this.session.autoDiscuss) {
            this.startNextRound();
        } else {
            this.setStatus(ConversationStatus.WAITING_USER);
        }
    }

    /**
     * Start a new discussion round
     */
    async startNextRound(): Promise<void> {
        outputChannel.appendLine(`KBUX starting next round, status ${this.status}`)
        if (this.status === ConversationStatus.PROCESSING) {
            return; // Already processing
        }

        if (this.currentTurn >= this.maxTurns) {
            this.setStatus(ConversationStatus.IDLE);
            // Add a message indicating max turns reached
            this.addModeratorMessage("We've reached the maximum number of turns for this discussion. Let's wrap up here.");
            return;
        }

        this.setStatus(ConversationStatus.PROCESSING);
        this.currentTurn++;

        try {
            // Get responses from all experts
            await this.getAllExpertResponses();

            // Check if moderator should intervene
            const shouldIntervene = await this.moderator.shouldIntervene(this.session.messages);

            if (shouldIntervene) {
                // Get moderator response
                await this.getModeratorResponse();
            }

            // If auto-discuss is enabled and we haven't reached max turns, continue
            if (this.session.autoDiscuss && this.currentTurn < this.maxTurns) {
                // Small delay to avoid hammering APIs
                setTimeout(() => this.startNextRound(), 1000);
            } else {
                this.setStatus(ConversationStatus.WAITING_USER);
            }
        } catch (error) {
            console.error('Error during conversation round:', error);
            this.setStatus(ConversationStatus.ERROR);
        }
    }

    /**
     * Get responses from all expert agents
     */
    private async getAllExpertResponses(): Promise<void> {
        // Call each expert incrementally so they can respond to each other
        for(let expert of this.experts) {
            await this.getExpertResponse(expert);
        }
    }

    /**
     * Get a response from a specific expert
     */
    private async getExpertResponse(expert: ExpertAgent): Promise<void> {
        outputChannel.appendLine(`Got expert response from ${expert.getName()}}`);

        const message = await expert.generateMessage(
            this.session.messages,
            true, // Stream response
            (chunk: string) => {
                outputChannel.appendLine(`Got expert response from ${expert.getName()}} with the message ${chunk}`)

                // Handle streaming updates
                this.notifyMessageUpdate();
            }
        );

        // Add to session
        this.session.messages.push(message);

        // Update session timestamp
        this.session.updated = Date.now();

        // Notify listeners
        this.notifyMessageListeners(message);
    }

    /**
     * Get a response from the moderator
     */
    private async getModeratorResponse(): Promise<void> {
        const message = await this.moderator.generateMessage(
            this.session.messages,
            true, // Stream response
            () => {
                // Handle streaming updates
                this.notifyMessageUpdate();
            }
        );

        // Add to session
        this.session.messages.push(message);

        // Update session timestamp
        this.session.updated = Date.now();

        // Notify listeners
        this.notifyMessageListeners(message);
    }

    /**
     * Add a moderator message programmatically
     */
    private addModeratorMessage(content: string): void {
        const message: Message = {
            id: uuidv4(),
            sender: {
                id: this.moderator.getId(),
                name: this.moderator.getName(),
                role: AgentRole.MODERATOR,
                provider: this.moderator.getProviderType()
            },
            content,
            timestamp: Date.now()
        };

        // Add to session
        this.session.messages.push(message);

        // Update session timestamp
        this.session.updated = Date.now();

        // Notify listeners
        this.notifyMessageListeners(message);
    }

    /**
     * Set the current conversation status and notify listeners
     */
    private setStatus(status: ConversationStatus): void {
        this.status = status;
        this.notifyStatusListeners(status);
    }

    /**
     * Notify all message listeners of a new message
     */
    private notifyMessageListeners(message: Message): void {
        this.messageListeners.forEach(listener => listener(message));
    }

    /**
     * Notify that a message has been updated (streaming)
     */
    private notifyMessageUpdate(): void {
        if (this.session.messages.length > 0) {
            const lastMessage = this.session.messages[this.session.messages.length - 1];
            this.notifyMessageListeners(lastMessage);
        }
    }

    /**
     * Notify all status listeners of a status change
     */
    private notifyStatusListeners(status: ConversationStatus): void {
        this.statusListeners.forEach(listener => listener(status));
    }

    /**
     * Add a message listener
     */
    onMessage(listener: (message: Message) => void): void {
        this.messageListeners.push(listener);
    }

    /**
     * Add a status listener
     */
    onStatusChange(listener: (status: ConversationStatus) => void): void {
        this.statusListeners.push(listener);
    }

    /**
     * Get the current session
     */
    getSession(): ConversationSession {
        return { ...this.session };
    }

    /**
     * Get the current status
     */
    getStatus(): ConversationStatus {
        return this.status;
    }

    /**
     * Set auto-discuss mode
     */
    setAutoDiscuss(enabled: boolean): void {
        this.session.autoDiscuss = enabled;
        
        // If enabling and currently waiting, start next round
        if (enabled && this.status === ConversationStatus.WAITING_USER) {
            this.startNextRound();
        }
    }

    /**
     * Check if auto-discuss mode is enabled
     */
    isAutoDiscussEnabled(): boolean {
        return !!this.session.autoDiscuss;
    }

    /**
     * Set maximum number of turns
     */
    setMaxTurns(maxTurns: number): void {
        this.maxTurns = maxTurns;
        this.session.maxTurns = maxTurns;
    }

    /**
     * Update the session goal
     */
    setGoal(goal: string): void {
        this.session.goal = goal;
        this.moderator.setGoal(goal);
    }

    /**
     * Reset the conversation (clear messages but keep settings)
     */
    reset(): void {
        this.session.messages = [];
        this.currentTurn = 0;
        this.setStatus(ConversationStatus.IDLE);
    }
} 