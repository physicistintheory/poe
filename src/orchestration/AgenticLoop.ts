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
 * 
 * Key Design Principles:
 * 1. User-Centric Flow: Each loop iteration responds to user input
 * 2. Expert Panel Autonomy: Experts can respond to each other naturally
 * 3. Minimal Moderator Intervention: Only intervenes when follow-up questions are needed
 * 4. Question Resolution Focus: Primary goal is to fully address the user's question
 * 5. Quality Maintenance: Ensures discussion stays focused and productive
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
    private lastUserMessage: string = '';
    private discussionContext: {
        topicConvergence: number;
        conflictLevel: number;
        expertInteractions: number;
        goalAlignment: number;
    } = {
        topicConvergence: 0,
        conflictLevel: 0,
        expertInteractions: 0,
        goalAlignment: 0
    };

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
     * This is the main entry point that orchestrates the discussion flow
     */
    async execute(userMessage?: string): Promise<void> {
        outputChannel.appendLine(`AgenticLoop: Starting execution with user message: "${userMessage || 'none'}"`);
        
        // 1. Loop Initialization
        if (!this.initializeLoop(userMessage)) {
            return;
        }

        try {
            // 2. Expert Response Phase - Let experts respond naturally to the user's input
            await this.executeExpertResponsePhase();

            // 3. Discussion Analysis Phase - Analyze the quality and direction of discussion
            await this.executeDiscussionAnalysisPhase();

            // 4. Moderator Decision Phase - Determine if moderator intervention is needed
            const shouldIntervene = await this.executeModeratorDecisionPhase();

            // 5. Moderator Action Phase (only if follow-up question needed)
            if (shouldIntervene) {
                await this.executeModeratorActionPhase();
                // Stop here and wait for user response
                return;
            }

            // 6. Loop Continuation Decision - Evaluate if discussion should continue
            const shouldContinue = this.evaluateLoopContinuation();

            // 7. Loop Termination or Continuation
            if (shouldContinue && this.session.autoDiscuss && this.currentTurn < this.maxTurns) {
                // Continue the discussion automatically if conditions are met
                outputChannel.appendLine('AgenticLoop: Continuing discussion automatically');
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
     * Validates session state and prepares for a new discussion round
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
        if (userMessage && userMessage.trim()) {
            this.lastUserMessage = userMessage.trim();
            const message: Message = {
                id: uuidv4(),
                sender: {
                    id: 'user',
                    name: 'User',
                    role: AgentRole.USER
                },
                content: this.lastUserMessage,
                timestamp: Date.now()
            };
            this.session.messages.push(message);
            this.session.updated = Date.now();
            this.notifyMessageListeners(message);
            
            // Reset question resolution when new user input is received
            this.questionResolution = Math.max(0, this.questionResolution - 0.1);
            this.pendingUserInput = false;
        }

        this.setStatus(ConversationStatus.PROCESSING);
        this.currentTurn++;

        outputChannel.appendLine(`AgenticLoop: Initialized loop, turn ${this.currentTurn}, user message: "${this.lastUserMessage}"`);
        return true;
    }

    /**
     * 2. Expert Response Phase
     * Let experts respond naturally to the user's input and each other
     */
    private async executeExpertResponsePhase(): Promise<void> {
        outputChannel.appendLine('AgenticLoop: Starting expert response phase');

        // Determine which experts should respond based on the current context
        const respondingExperts = this.selectRespondingExperts();
        
        outputChannel.appendLine(`AgenticLoop: Selected ${respondingExperts.length} experts to respond: ${respondingExperts.map(e => e.getName()).join(', ')}`);

        for (const expert of respondingExperts) {
            try {
                await this.getExpertResponse(expert);
                // Small delay between expert responses to allow for natural conversation flow
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                outputChannel.appendLine(`AgenticLoop: Error getting response from expert ${expert.getName()}: ${error}`);
                // Continue with other experts
            }
        }
    }

    /**
     * Select which experts should respond based on current context
     */
    private selectRespondingExperts(): ExpertAgent[] {
        // If this is the first turn or we have a new user message, all experts should respond
        if (this.currentTurn === 1 || this.lastUserMessage) {
            return this.experts;
        }

        // For subsequent turns, let experts respond based on engagement and relevance
        const respondingExperts: ExpertAgent[] = [];
        
        for (const expert of this.experts) {
            const engagement = this.expertEngagement.get(expert.getId()) || 0;
            const shouldRespond = this.shouldExpertRespond(expert, engagement);
            
            if (shouldRespond) {
                respondingExperts.push(expert);
            }
        }

        // Ensure at least one expert responds
        if (respondingExperts.length === 0 && this.experts.length > 0) {
            // Select the most engaged expert
            let bestExpert = this.experts[0];
            let bestEngagement = this.expertEngagement.get(bestExpert.getId()) || 0;
            
            for (const expert of this.experts) {
                const engagement = this.expertEngagement.get(expert.getId()) || 0;
                if (engagement > bestEngagement) {
                    bestExpert = expert;
                    bestEngagement = engagement;
                }
            }
            
            respondingExperts.push(bestExpert);
        }

        return respondingExperts;
    }

    /**
     * Determine if an expert should respond based on engagement and context
     */
    private shouldExpertRespond(expert: ExpertAgent, engagement: number): boolean {
        // Higher engagement experts are more likely to respond
        const engagementThreshold = 0.3 + (engagement * 0.4);
        const random = Math.random();
        
        return random < engagementThreshold;
    }

    /**
     * Get a response from a specific expert
     */
    private async getExpertResponse(expert: ExpertAgent): Promise<void> {
        outputChannel.appendLine(`AgenticLoop: Getting response from expert ${expert.getName()}`);

        // Prepare context for the expert
        this.prepareExpertContext(expert);

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

        // Update expert engagement based on response quality
        const engagementScore = this.assessResponseQuality(message);
        this.expertEngagement.set(expert.getId(), engagementScore);

        // Notify listeners
        this.notifyMessageListeners(message);
    }

    /**
     * Prepare context for expert response generation
     */
    private prepareExpertContext(expert: ExpertAgent): void {
        // Context is prepared but not currently used in this implementation
        // Could be passed to expert.generateMessage() in the future
        const context = {
            currentTurn: this.currentTurn,
            userMessage: this.lastUserMessage,
            discussionContext: this.discussionContext,
            expertRole: expert.getSpecialization(),
            goal: this.session.goal
        };
        
        // For now, just log the context for debugging
        outputChannel.appendLine(`AgenticLoop: Prepared context for ${expert.getName()}: turn ${context.currentTurn}`);
    }

    /**
     * Assess the quality of an expert's response
     */
    private assessResponseQuality(message: Message): number {
        // Simple quality assessment based on message length and content
        const content = message.content.toLowerCase();
        const length = message.content.length;
        
        let quality = 0.5; // Base quality
        
        // Length factor (not too short, not too long)
        if (length > 50 && length < 1000) {
            quality += 0.2;
        }
        
        // Content relevance factors
        if (this.lastUserMessage && content.includes(this.lastUserMessage.toLowerCase().split(' ')[0])) {
            quality += 0.1;
        }
        
        // Engagement indicators
        if (content.includes('?') || content.includes('however') || content.includes('but')) {
            quality += 0.1; // Shows interaction with other experts
        }
        
        return Math.min(1.0, quality);
    }

    /**
     * 3. Discussion Analysis Phase
     * Analyze the quality and direction of the discussion
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

        // Update discussion context
        this.updateDiscussionContext();
    }

    private analyzeExpertInteractions(): void {
        // Analyze how experts are responding to each other
        const recentMessages = this.session.messages.slice(-10);
        let interactions = 0;
        
        for (let i = 1; i < recentMessages.length; i++) {
            const prev = recentMessages[i - 1];
            const curr = recentMessages[i];
            
            // Add null checks to prevent errors
            if (prev && curr && prev.sender && curr.sender && 
                prev.sender.role === AgentRole.EXPERT && curr.sender.role === AgentRole.EXPERT) {
                // Check if current message references previous expert's content
                const currContent = curr.content.toLowerCase();
                
                if (currContent.includes(prev.sender.name.toLowerCase()) || 
                    currContent.includes('however') || 
                    currContent.includes('but') ||
                    currContent.includes('agree') ||
                    currContent.includes('disagree')) {
                    interactions++;
                }
            }
        }
        
        this.discussionContext.expertInteractions = Math.min(1.0, interactions / 5);
        outputChannel.appendLine(`AgenticLoop: Expert interactions analyzed: ${interactions} interactions detected`);
    }

    private assessTopicConvergence(): void {
        // Evaluate if discussion is moving toward the goal
        const recentMessages = this.session.messages.slice(-5);
        const goalKeywords = this.session.goal.toLowerCase().split(' ');
        let convergenceScore = 0;
        
        for (const message of recentMessages) {
            if (message && message.content) {
                const content = message.content.toLowerCase();
                let keywordMatches = 0;
                
                for (const keyword of goalKeywords) {
                    if (content.includes(keyword)) {
                        keywordMatches++;
                    }
                }
                
                convergenceScore += keywordMatches / goalKeywords.length;
            }
        }
        
        this.discussionContext.topicConvergence = Math.min(1.0, convergenceScore / recentMessages.length);
        outputChannel.appendLine(`AgenticLoop: Topic convergence assessed: ${this.discussionContext.topicConvergence}`);
    }

    private detectConflicts(): void {
        // Identify disagreements or conflicting viewpoints
        const recentMessages = this.session.messages.slice(-5);
        let conflicts = 0;
        
        for (const message of recentMessages) {
            if (message && message.content) {
                const content = message.content.toLowerCase();
                if (content.includes('disagree') || content.includes('wrong') || content.includes('incorrect') || 
                    content.includes('however') || content.includes('but') || content.includes('on the other hand')) {
                    conflicts++;
                }
            }
        }
        
        this.discussionContext.conflictLevel = Math.min(1.0, conflicts / recentMessages.length);
        outputChannel.appendLine(`AgenticLoop: Conflicts detected: ${conflicts} conflict indicators`);
    }

    private monitorEngagement(): void {
        // Track participation levels and response quality
        let totalEngagement = 0;
        let activeExperts = 0;
        
        for (const [, engagement] of this.expertEngagement) {
            totalEngagement += engagement;
            if (engagement > 0.3) {
                activeExperts++;
            }
        }
        
        const avgEngagement = totalEngagement / this.experts.length;
        const participationRate = activeExperts / this.experts.length;
        
        this.discussionQuality = (avgEngagement + participationRate) / 2;
        outputChannel.appendLine(`AgenticLoop: Engagement monitored - avg: ${avgEngagement.toFixed(2)}, participation: ${participationRate.toFixed(2)}`);
    }

    private assessQuestionResolution(): void {
        // Assess if the user's question has been adequately addressed
        const recentMessages = this.session.messages.slice(-5);
        let resolutionScore = this.questionResolution;
        
        // Check if recent messages provide comprehensive answers
        for (const message of recentMessages) {
            if (message && message.sender && message.content && message.sender.role === AgentRole.EXPERT) {
                const content = message.content.toLowerCase();
                
                // Positive indicators
                if (content.includes('solution') || content.includes('answer') || content.includes('recommendation')) {
                    resolutionScore += 0.05;
                }
                
                // Negative indicators
                if (content.includes('need more information') || content.includes('clarify') || content.includes('unclear')) {
                    resolutionScore -= 0.02;
                }
            }
        }
        
        // Consider topic convergence
        resolutionScore += this.discussionContext.topicConvergence * 0.1;
        
        this.questionResolution = Math.max(0, Math.min(1.0, resolutionScore));
        outputChannel.appendLine(`AgenticLoop: Question resolution assessed: ${this.questionResolution.toFixed(2)}`);
    }

    private updateDiscussionContext(): void {
        // Update goal alignment based on topic convergence and question resolution
        this.discussionContext.goalAlignment = (this.discussionContext.topicConvergence + this.questionResolution) / 2;
        outputChannel.appendLine(`AgenticLoop: Discussion context updated - goal alignment: ${this.discussionContext.goalAlignment.toFixed(2)}`);
    }

    /**
     * 4. Moderator Decision Phase
     * Determine if moderator intervention is needed (only for follow-up questions)
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
        const recentMessages = this.session.messages.slice(-5);
        
        // Check for indicators that user input is needed
        let needsInput = false;
        
        for (const message of recentMessages) {
            if (message && message.content) {
                const content = message.content.toLowerCase();
                
                // Check for questions or requests for clarification
                if (content.includes('?') && (content.includes('clarify') || content.includes('specific') || content.includes('context'))) {
                    needsInput = true;
                    break;
                }
                
                // Check for ambiguous aspects
                if (content.includes('unclear') || content.includes('need more information') || content.includes('assume')) {
                    needsInput = true;
                    break;
                }
            }
        }
        
        // Also check if we haven't had user input recently and question isn't well resolved
        const hasRecentUserInput = recentMessages.some(msg => msg && msg.sender && msg.sender.role === AgentRole.USER);
        const lowResolution = this.questionResolution < 0.6;
        
        return needsInput || (!hasRecentUserInput && lowResolution);
    }

    /**
     * 5. Moderator Action Phase (only if follow-up question needed)
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
        // Generate appropriate follow-up question for the user based on current context
        const questionTypes = [
            "Could you clarify what specific aspect you'd like us to focus on?",
            "Would you like us to explore any related topics?",
            "Do you have any additional context that might help us provide a better answer?",
            "Is there a particular perspective or approach you're most interested in?",
            "Have we addressed your question satisfactorily, or is there something else you'd like to know?"
        ];

        // Select question based on context
        let selectedQuestion = questionTypes[0]; // Default
        
        if (this.questionResolution < 0.3) {
            selectedQuestion = "Could you provide more specific details about what you're looking for?";
        } else if (this.discussionContext.conflictLevel > 0.5) {
            selectedQuestion = "I notice there are some differing opinions. Which perspective would you like us to explore further?";
        } else if (this.discussionContext.topicConvergence < 0.3) {
            selectedQuestion = "We seem to be covering a broad range of topics. Is there a particular area you'd like us to focus on?";
        } else if (this.questionResolution > 0.7) {
            selectedQuestion = "We've covered quite a bit of ground. Is there anything specific you'd like us to clarify or expand on?";
        }

        return selectedQuestion;
    }

    /**
     * 6. Loop Continuation Decision
     * Evaluate if discussion should continue automatically
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

        // Check if experts are still engaged
        const activeExperts = Array.from(this.expertEngagement.values()).filter(e => e > 0.3).length;
        if (activeExperts < 2) {
            outputChannel.appendLine('AgenticLoop: Not enough active experts, terminating loop');
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
        } else if (this.discussionQuality < 0.5) {
            this.addModeratorMessage("The discussion quality has declined. Would you like to ask a more specific question or explore a different aspect?");
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
        this.lastUserMessage = '';
        this.discussionContext = {
            topicConvergence: 0,
            conflictLevel: 0,
            expertInteractions: 0,
            goalAlignment: 0
        };
        this.setStatus(ConversationStatus.IDLE);
    }
} 