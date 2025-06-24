import { v4 as uuidv4 } from 'uuid';
import {
    ConversationSession,
    Message,
    AgentRole,
    ConversationStatus
} from '../types';
import { ExpertAgent } from '../agents/ExpertAgent';
import { ModeratorAgent } from '../agents/ModeratorAgent';
import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;
export function setAgenticLoopOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel;
}

/**
 * Manages the agentic loop for a moderated panel of expert agents
 * Implements the structured discussion flow where experts contribute insights
 * while a moderator guides the conversation toward resolving the user's question
 */
export class AgenticLoop {
    private session: ConversationSession;
    private experts: ExpertAgent[];
    private moderator: ModeratorAgent;
    private status: ConversationStatus = ConversationStatus.IDLE;
    private maxTurns: number;
    private currentTurn: number = 0;
    private messageListeners: ((message: Message) => void)[] = [];
    private statusListeners: ((status: ConversationStatus) => void)[] = [];

    // Loop state variables
    private questionResolution: number = 0; // 0-1 scale of how well question is addressed
    private expertEngagement: Map<string, number> = new Map(); // Expert ID -> engagement score
    private userSatisfaction: boolean = false;
    private discussionQuality: number = 1.0;
    private pendingUserInput: boolean = false;

    constructor(
        session: ConversationSession,
        experts: ExpertAgent[],
        moderator: ModeratorAgent,
        maxTurns: number = 50
    ) {
        this.session = session;
        this.experts = experts;
        this.moderator = moderator;
        this.maxTurns = maxTurns;
    }

    /**
     * Execute the agentic loop to address the user's question
     */
    async execute(userMessage?: string): Promise<void> {
        outputChannel.appendLine(`AgenticLoop: Starting execution, status ${this.status}`);
        
        // 1. Loop Initialization
        if (!this.initializeLoop(userMessage)) {
            return;
        }

        try {
            // 2. Expert Response Phase
            await this.executeExpertResponsePhase();

            // 3. Discussion Analysis Phase
            await this.executeDiscussionAnalysisPhase();

            // 4. Moderator Decision Phase
            const shouldIntervene = await this.executeModeratorDecisionPhase();

            // 5. Moderator Action Phase (if needed)
            if (shouldIntervene) {
                await this.executeModeratorActionPhase();
            }

            // 6. Loop Continuation Decision
            const shouldContinue = this.evaluateLoopContinuation();

            // 7. Loop Termination or Continuation
            if (shouldContinue && this.session.autoDiscuss && this.currentTurn < this.maxTurns) {
                // Small delay to avoid hammering APIs
                setTimeout(() => this.execute(), 1000);
            } else {
                this.terminateLoop();
            }

        } catch (error) {
            console.error('Error during agentic loop execution:', error);
            this.setStatus(ConversationStatus.ERROR);
        }
    }

    /**
     * 1. Loop Initialization
     */
    private initializeLoop(userMessage?: string): boolean {
        if (this.status === ConversationStatus.PROCESSING) {
            outputChannel.appendLine('AgenticLoop: Already processing, skipping initialization');
            return false;
        }

        if (this.currentTurn >= this.maxTurns) {
            outputChannel.appendLine('AgenticLoop: Max turns reached, terminating');
            this.setStatus(ConversationStatus.IDLE);
            this.addModeratorMessage("We've reached the maximum number of turns for this discussion. Let's wrap up here.");
            return false;
        }

        // Add user message if provided
        if (userMessage) {
            const message: Message = {
                id: uuidv4(),
                sender: {
                    id: 'user',
                    name: 'User',
                    role: AgentRole.USER
                },
                content: userMessage,
                timestamp: Date.now()
            };
            this.session.messages.push(message);
            this.session.updated = Date.now();
            this.notifyMessageListeners(message);
        }

        this.setStatus(ConversationStatus.PROCESSING);
        this.currentTurn++;
        this.pendingUserInput = false;

        outputChannel.appendLine(`AgenticLoop: Initialized loop, turn ${this.currentTurn}`);
        return true;
    }

    /**
     * 2. Expert Response Phase
     */
    private async executeExpertResponsePhase(): Promise<void> {
        outputChannel.appendLine('AgenticLoop: Starting expert response phase');

        for (const expert of this.experts) {
            try {
                await this.getExpertResponse(expert);
            } catch (error) {
                outputChannel.appendLine(`AgenticLoop: Error getting response from expert ${expert.getName()}: ${error}`);
                // Continue with other experts
            }
        }
    }

    /**
     * Get a response from a specific expert
     */
    private async getExpertResponse(expert: ExpertAgent): Promise<void> {
        outputChannel.appendLine(`AgenticLoop: Getting response from expert ${expert.getName()}`);

        const message = await expert.generateMessage(
            this.session.messages,
            true, // Stream response
            (_chunk: string) => {
                // Handle streaming updates
                this.notifyMessageUpdate();
            }
        );
        
        // Add to session
        this.session.messages.push(message);
        this.session.updated = Date.now();

        // Update expert engagement
        this.expertEngagement.set(expert.getId(), 1.0);

        // Notify listeners
        this.notifyMessageListeners(message);
    }

    /**
     * 3. Discussion Analysis Phase
     */
    private async executeDiscussionAnalysisPhase(): Promise<void> {
        outputChannel.appendLine('AgenticLoop: Analyzing discussion');

        // Analyze expert interactions
        this.analyzeExpertInteractions();

        // Check topic convergence
        this.assessTopicConvergence();

        // Detect conflicts
        this.detectConflicts();

        // Monitor engagement
        this.monitorEngagement();

        // Check question resolution
        this.assessQuestionResolution();
    }

    private analyzeExpertInteractions(): void {
        // Analyze how experts are responding to each other
        // Implementation would analyze message patterns, references, etc.
        outputChannel.appendLine('AgenticLoop: Expert interactions analyzed');
    }

    private assessTopicConvergence(): void {
        // Evaluate if discussion is moving toward the goal
        // Implementation would analyze topic consistency and goal alignment
        outputChannel.appendLine('AgenticLoop: Topic convergence assessed');
    }

    private detectConflicts(): void {
        // Identify disagreements or conflicting viewpoints
        // Implementation would detect opposing viewpoints or contradictions
        outputChannel.appendLine('AgenticLoop: Conflicts detected');
    }

    private monitorEngagement(): void {
        // Track participation levels and response quality
        // Implementation would assess expert participation and response quality
        outputChannel.appendLine('AgenticLoop: Engagement monitored');
    }

    private assessQuestionResolution(): void {
        // Assess if the user's question has been adequately addressed
        // Implementation would analyze how well the discussion addresses the user's question
        this.questionResolution = Math.min(1.0, this.questionResolution + 0.1);
        outputChannel.appendLine(`AgenticLoop: Question resolution assessed: ${this.questionResolution}`);
    }

    /**
     * 4. Moderator Decision Phase
     */
    private async executeModeratorDecisionPhase(): Promise<boolean> {
        outputChannel.appendLine('AgenticLoop: Evaluating moderator intervention');

        // Check if question is fully resolved
        if (this.questionResolution >= 0.9) {
            outputChannel.appendLine('AgenticLoop: Question appears resolved, no moderator intervention needed');
            return false;
        }

        // Check if additional user input is needed
        const needsUserInput = await this.assessNeedForUserInput();
        
        if (needsUserInput) {
            outputChannel.appendLine('AgenticLoop: User input needed, moderator will intervene');
            return true;
        }

        outputChannel.appendLine('AgenticLoop: No moderator intervention needed');
        return false;
    }

    private async assessNeedForUserInput(): Promise<boolean> {
        // Determine if additional information from the user is needed
        // This could be based on:
        // - Ambiguous aspects in the user's original question
        // - Missing context that experts need
        // - User confirmation needed for question scope
        
        // For now, use a simple heuristic
        const recentMessages = this.session.messages.slice(-5);
        const hasUserMessage = recentMessages.some(msg => msg.sender.role === AgentRole.USER);
        
        return !hasUserMessage && this.questionResolution < 0.7;
    }

    /**
     * 5. Moderator Action Phase
     */
    private async executeModeratorActionPhase(): Promise<void> {
        outputChannel.appendLine('AgenticLoop: Executing moderator action');

        const followUpQuestion = await this.generateFollowUpQuestion();
        
        const message: Message = {
            id: uuidv4(),
            sender: {
                id: this.moderator.getId(),
                name: this.moderator.getName(),
                role: AgentRole.MODERATOR,
                provider: this.moderator.getProviderType()
            },
            content: followUpQuestion,
            timestamp: Date.now()
        };

        // Add to session
        this.session.messages.push(message);
        this.session.updated = Date.now();

        // Set pending user input flag
        this.pendingUserInput = true;

        // Notify listeners
        this.notifyMessageListeners(message);

        // Update status to wait for user
        this.setStatus(ConversationStatus.WAITING_USER);
    }

    private async generateFollowUpQuestion(): Promise<string> {
        // Generate appropriate follow-up question for the user
        // This could be:
        // - Clarification request
        // - Additional context request
        // - Question refinement
        // - Scope expansion
        // - Conclusion confirmation

        const questionTypes = [
            "Could you clarify what specific aspect you'd like us to focus on?",
            "Would you like us to explore any related topics?",
            "Do you have any additional context that might help us provide a better answer?",
            "Is there a particular perspective or approach you're most interested in?",
            "Have we addressed your question satisfactorily, or is there something else you'd like to know?"
        ];

        // Simple random selection for now
        const randomIndex = Math.floor(Math.random() * questionTypes.length);
        return questionTypes[randomIndex];
    }

    /**
     * 6. Loop Continuation Decision
     */
    private evaluateLoopContinuation(): boolean {
        outputChannel.appendLine('AgenticLoop: Evaluating loop continuation');

        // Check if question is fully addressed
        if (this.questionResolution >= 0.9) {
            outputChannel.appendLine('AgenticLoop: Question fully addressed, terminating loop');
            return false;
        }

        // Check if user satisfaction is indicated
        if (this.userSatisfaction) {
            outputChannel.appendLine('AgenticLoop: User satisfied, terminating loop');
            return false;
        }

        // Check if we're waiting for user input
        if (this.pendingUserInput) {
            outputChannel.appendLine('AgenticLoop: Waiting for user input, pausing loop');
            return false;
        }

        // Check auto-discuss and turn limits
        if (!this.session.autoDiscuss || this.currentTurn >= this.maxTurns) {
            outputChannel.appendLine('AgenticLoop: Auto-discuss disabled or max turns reached');
            return false;
        }

        // Check discussion quality
        if (this.discussionQuality < 0.5) {
            outputChannel.appendLine('AgenticLoop: Discussion quality too low, terminating loop');
            return false;
        }

        outputChannel.appendLine('AgenticLoop: Continuing loop');
        return true;
    }

    /**
     * 7. Loop Termination
     */
    private terminateLoop(): void {
        outputChannel.appendLine('AgenticLoop: Terminating loop');

        if (this.questionResolution >= 0.9) {
            this.addModeratorMessage("I believe we've addressed your question comprehensively. Is there anything else you'd like to know?");
        } else if (this.currentTurn >= this.maxTurns) {
            this.addModeratorMessage("We've reached the maximum number of turns for this discussion. Let's wrap up here.");
        } else {
            this.addModeratorMessage("The discussion has concluded. Feel free to ask any follow-up questions.");
        }

        this.setStatus(ConversationStatus.WAITING_USER);
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

        this.session.messages.push(message);
        this.session.updated = Date.now();
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
     * Set user satisfaction
     */
    setUserSatisfaction(satisfied: boolean): void {
        this.userSatisfaction = satisfied;
    }

    /**
     * Reset the loop state
     */
    reset(): void {
        this.currentTurn = 0;
        this.questionResolution = 0;
        this.expertEngagement.clear();
        this.userSatisfaction = false;
        this.discussionQuality = 1.0;
        this.pendingUserInput = false;
        this.setStatus(ConversationStatus.IDLE);
    }
} 