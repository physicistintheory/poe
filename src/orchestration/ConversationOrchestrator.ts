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
import { AgenticLoop, setAgenticLoopOutputChannel } from './AgenticLoop';
import * as vscode from 'vscode';
let outputChannel: vscode.OutputChannel;
export function setConversationOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel;
    setAgenticLoopOutputChannel(channel);
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
    private agenticLoop!: AgenticLoop;

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

        // Initialize agentic loop
        this.initializeAgenticLoop();
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
            if (outputChannel) {
                outputChannel.appendLine(`Created expert2: ${expertConfig.name}`);
            }
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
     * Initialize the agentic loop
     */
    private initializeAgenticLoop(): void {
        this.agenticLoop = new AgenticLoop(
            this.session,
            this.experts,
            this.moderator,
            this.maxTurns
        );

        // Wire up listeners
        this.agenticLoop.onMessage((message: Message) => {
            this.notifyMessageListeners(message);
        });

        this.agenticLoop.onStatusChange((status: ConversationStatus) => {
            this.status = status;
            this.notifyStatusListeners(status);
        });
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

        // If auto-discuss is enabled, start the agentic loop
        if (outputChannel) {
            outputChannel.appendLine(`KBUX message received, autodiscuss: ${this.session.autoDiscuss}`);
        }
        if (this.session.autoDiscuss) {
            this.startAgenticLoop();
        } else {
            this.setStatus(ConversationStatus.WAITING_USER);
        }
    }

    /**
     * Start the agentic loop
     */
    async startAgenticLoop(): Promise<void> {
        const startTime = Date.now();
        if (outputChannel) {
            outputChannel.appendLine(`KBUX starting agentic loop, status ${this.status}`);
        }
        
        try {
            // Execute the agentic loop
            await this.agenticLoop.execute();
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            if (outputChannel) {
                outputChannel.appendLine(`KBUX agentic loop completed in ${duration}ms`);
            }
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            if (outputChannel) {
                outputChannel.appendLine(`KBUX agentic loop failed after ${duration}ms: ${error}`);
            }
            throw error;
        }
    }

    /**
     * Continue the agentic loop with additional user input
     */
    async continueAgenticLoop(userMessage?: string): Promise<void> {
        const startTime = Date.now();
        if (outputChannel) {
            outputChannel.appendLine(`KBUX continuing agentic loop with user message: ${userMessage}`);
        }
        
        try {
            // Execute the agentic loop with optional user message
            await this.agenticLoop.execute(userMessage);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            if (outputChannel) {
                outputChannel.appendLine(`KBUX agentic loop continued in ${duration}ms`);
            }
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            if (outputChannel) {
                outputChannel.appendLine(`KBUX agentic loop continuation failed after ${duration}ms: ${error}`);
            }
            throw error;
        }
    }

    /**
     * Start the next round of the conversation (for test compatibility)
     */
    async startNextRound(): Promise<void> {
        const startTime = Date.now();
        if (outputChannel) {
            outputChannel.appendLine('KBUX starting next round');
        }
        
        try {
            // Execute the agentic loop to start the next round
            await this.agenticLoop.execute();
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            if (outputChannel) {
                outputChannel.appendLine(`KBUX next round completed in ${duration}ms`);
            }
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            if (outputChannel) {
                outputChannel.appendLine(`KBUX next round failed after ${duration}ms: ${error}`);
            }
            throw error;
        }
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
            this.startAgenticLoop();
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
        // Update agentic loop max turns
        this.agenticLoop = new AgenticLoop(
            this.session,
            this.experts,
            this.moderator,
            maxTurns
        );
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
        this.agenticLoop.reset();
    }

    /**
     * Set user satisfaction (for agentic loop)
     */
    setUserSatisfaction(satisfied: boolean): void {
        this.agenticLoop.setUserSatisfaction(satisfied);
    }
} 