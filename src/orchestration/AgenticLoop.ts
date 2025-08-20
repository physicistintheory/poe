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

function log(message: string): void {
    if (outputChannel) {
        outputChannel.appendLine(message);
    }
}

/**
 * Manages the agentic loop for a moderated panel of expert agents
 * Implements the 2-step problem approach with parallel categorization queries
 * 
 * Step 1: Parallel Categorization Queries
 * - Query 1: Is the user's question answered?
 * - Query 2: Do we have enough information?
 * - Query 3: Who should answer next?
 * 
 * Step 2: Action Execution
 * - Action A: Request clarification from user
 * - Action B: Get expert response
 * - Action C: Conclude discussion
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
    private lastUserMessage: string = '';
    private pendingUserInput: boolean = false;
    private isFirstIteration: boolean = true;
    private lastResponderId: string = '';

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
     * Execute the agentic loop using the 2-step approach
     * This is the main entry point that orchestrates the discussion flow
     */
    async execute(userMessage?: string): Promise<void> {
        log(`AgenticLoop: Starting 2-step execution with user message: "${userMessage || 'none'}"`);
        
        // Initialize loop with new user message if provided
        if (!this.initializeLoop(userMessage)) {
            return;
        }

        try {
            // Step 1: Run parallel categorization queries
            const categorizationResults = await this.runParallelCategorizationQueries();

            // Step 2: Execute action based on categorization results
            await this.executeActionBasedOnCategorization(categorizationResults);

        } catch (error) {
            console.error('Error during agentic loop execution:', error);
            this.setStatus(ConversationStatus.ERROR);
        }
    }

    /**
     * Initialize the loop with new user message if provided
     */
    private initializeLoop(userMessage?: string): boolean {
        if (this.status === ConversationStatus.PROCESSING) {
            log('AgenticLoop: Already processing, skipping initialization');
            return false;
        }

        if (this.currentTurn >= this.maxTurns) {
            log('AgenticLoop: Max turns reached, terminating');
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
            
            // Reset for new user message
            this.isFirstIteration = true;
            this.pendingUserInput = false;
        } else {
            // Keep the last user message when no new user message is provided
            // This allows for continuation of the conversation
            this.pendingUserInput = false;
        }

        this.setStatus(ConversationStatus.PROCESSING);
        this.currentTurn++;

        log(`AgenticLoop: Initialized loop, turn ${this.currentTurn}, user message: "${this.lastUserMessage}"`);
        return true;
    }

    /**
     * Step 1: Execute parallel categorization queries
     */
    private async runParallelCategorizationQueries(): Promise<{
        questionAnswered: { answered: boolean; confidence: number };
        enoughInfo: { sufficient: boolean; missingInfo?: string };
        nextExpert: { expertId: string; reasoning: string };
    }> {
        log('AgenticLoop: Step 1 - Running parallel categorization queries');

        // Run all 3 queries in parallel
        const [questionAnswered, enoughInfo, nextExpert] = await Promise.all([
            this.isUserQuestionAnswered(),
            this.doWeHaveEnoughInformation(),
            this.whoShouldAnswerNext()
        ]);

        log(`AgenticLoop: Categorization results - Question answered: ${questionAnswered.answered} (${questionAnswered.confidence}), Enough info: ${enoughInfo.sufficient}, Next expert: ${nextExpert.expertId}`);

        return {
            questionAnswered,
            enoughInfo,
            nextExpert
        };
    }

    /**
     * Query 1: Question Resolution Assessment
     * "Is the user's question answered?"
     */
    private async isUserQuestionAnswered(): Promise<{ answered: boolean; confidence: number }> {
        // Skip on first iteration per user message
        if (this.isFirstIteration) {
            log('AgenticLoop: Query 1 - Skipping (first iteration)');
            return { answered: false, confidence: 0.0 };
        }

        const prompt = `Given the conversation history and the user's original question, determine if the user's question has been adequately answered.

User's question: "${this.lastUserMessage}"
Conversation history: ${this.getRecentConversationSummary()}

Respond with a JSON object:
{
  "answered": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

        try {
            const response = await this.moderator.generateMessage([{
                id: uuidv4(),
                sender: { id: 'system', name: 'System', role: AgentRole.MODERATOR },
                content: prompt,
                timestamp: Date.now()
            }], false);

            // Parse the response to extract the assessment
            const assessment = this.parseUserQuestionAnsweredResponse(response.content);
            log(`AgenticLoop: Query 1 - Question answered: ${assessment.answered} (confidence: ${assessment.confidence})`);
            return assessment;
        } catch (error) {
            log(`AgenticLoop: Query 1 - Error, defaulting to false: ${error}`);
            return { answered: false, confidence: 0.0 };
        }
    }

    /**
     * Query 2: Information Sufficiency Assessment
     * "Do we have enough information to engage the experts, or should we ask a clarifying question to the user?"
     */
    private async doWeHaveEnoughInformation(): Promise<{ sufficient: boolean; missingInfo?: string }> {
        const prompt = `Given the user's question and conversation context, determine if we have enough information to engage the experts effectively, or if we should ask the user for clarification.


Rules: Error on the side of allowing the converation to start.  If the question is related at all to the experts, let them start.  If the question is not related to the experts, ask the user for clarification.
User's question: "${this.lastUserMessage}"
Conversation context: ${this.getRecentConversationSummary()}
Expert capabilities: ${this.experts.map(e => e.getSpecialization()).join(', ')}

Respond with a JSON object:
{
  "sufficient": true/false,
  "missingInfo": "specific missing information if insufficient",
  "reasoning": "brief explanation"
}`;

        try {
            const response = await this.moderator.generateMessage([{
                id: uuidv4(),
                sender: { id: 'system', name: 'System', role: AgentRole.MODERATOR },
                content: prompt,
                timestamp: Date.now()
            }], false);

            const assessment = this.parseEnoughInformationResponse(response.content);
            log(`AgenticLoop: Query 2 - Enough info: ${assessment.sufficient}${assessment.missingInfo ? ` (missing: ${assessment.missingInfo})` : ''}`);
            return assessment;
        } catch (error) {
            log(`AgenticLoop: Query 2 - Error, defaulting to sufficient: ${error}`);
            return { sufficient: true };
        }
    }

    /**
     * Query 3: Expert Selection
     * "Given these descriptions of experts, including who answered last time, who should answer next?"
     */
    private async whoShouldAnswerNext(): Promise<{ expertId: string; reasoning: string }> {
        const expertDescriptions = this.experts.map(expert => 
            `${expert.getName()} (${expert.getId()}): ${expert.getSpecialization()}`
        ).join('\n');

        const prompt = `Given the expert descriptions, conversation history, and who answered last, determine which expert should answer next.

Expert descriptions:
${expertDescriptions}

Last responder: ${this.lastResponderId || 'none'}
User's question: "${this.lastUserMessage}"
Conversation context: ${this.getRecentConversationSummary()}

IMPORTANT: You must use the exact expert ID from the descriptions above. Do not make up IDs like "expert_1" or "expert_2".

Respond with a JSON object:
{
  "expertId": "exact_expert_id_from_descriptions",
  "reasoning": "brief explanation of why this expert should answer next"
}`;

        try {
            const response = await this.moderator.generateMessage([{
                id: uuidv4(),
                sender: { id: 'system', name: 'System', role: AgentRole.MODERATOR },
                content: prompt,
                timestamp: Date.now()
            }], false);

            const selection = this.parseNextExpertSelectionResponse(response.content);
            log(`AgenticLoop: Query 3 - Selected expert: ${selection.expertId} (${selection.reasoning})`);
            return selection;
        } catch (error) {
            log(`AgenticLoop: Query 3 - Error, using fallback selection: ${error}`);
            return this.selectFallbackExpert();
        }
    }

    /**
     * Step 2: Execute action based on categorization results
     */
    private async executeActionBasedOnCategorization(categorizationResults: {
        questionAnswered: { answered: boolean; confidence: number };
        enoughInfo: { sufficient: boolean; missingInfo?: string };
        nextExpert: { expertId: string; reasoning: string };
    }): Promise<void> {
        log('AgenticLoop: Step 2 - Executing action based on categorization');

        const { questionAnswered, enoughInfo, nextExpert } = categorizationResults;

        // Action A: Request Clarification
        if (!enoughInfo.sufficient) {
            await this.requestClarificationFromUser(enoughInfo.missingInfo);
            return;
        }

        // Action C: Conclude Discussion
        if (questionAnswered.answered && questionAnswered.confidence >= 0.8) {
            await this.concludeDiscussion();
            return;
        }

        // Action B: Expert Response
        if (enoughInfo.sufficient && !questionAnswered.answered) {
            await this.getResponseFromExpert(nextExpert.expertId);
            return;
        }

        // Fallback: Default to expert response
        log('AgenticLoop: No clear action determined, defaulting to expert response');
        await this.getResponseFromExpert(nextExpert.expertId);
    }

    /**
     * Action A: Request clarification from user
     */
    private async requestClarificationFromUser(missingInfo?: string): Promise<void> {
        log('AgenticLoop: Action A - Requesting clarification from user');

        const clarificationQuestion = missingInfo 
            ? `To provide you with the best possible answer, could you please clarify: ${missingInfo}`
            : "Could you please provide more specific details about what you're looking for?";

        const message: Message = {
            id: uuidv4(),
            sender: {
                id: this.moderator.getId(),
                name: this.moderator.getName(),
                role: AgentRole.MODERATOR,
                provider: this.moderator.getProviderType()
            },
            content: clarificationQuestion,
            timestamp: Date.now()
        };

        this.session.messages.push(message);
        this.session.updated = Date.now();
        this.pendingUserInput = true;
        this.notifyMessageListeners(message);
        this.setStatus(ConversationStatus.WAITING_USER);
    }

    /**
     * Action B: Get expert response
     */
    private async getResponseFromExpert(expertId: string): Promise<void> {
        log(`AgenticLoop: Action B - Getting response from expert ${expertId}`);

        const expert = this.experts.find(e => e.getId() === expertId);
        if (!expert) {
            log(`AgenticLoop: Expert ${expertId} not found, available experts: ${this.experts.map(e => e.getId()).join(', ')}`);
            const fallbackExpert = this.experts[0];
            log(`AgenticLoop: Using fallback expert: ${fallbackExpert.getName()} (${fallbackExpert.getId()})`);
            await this.getResponseFromExpertAgent(fallbackExpert);
            return;
        }

        log(`AgenticLoop: Found expert: ${expert.getName()} (${expert.getId()})`);
        await this.getResponseFromExpertAgent(expert);
    }

    /**
     * Action C: Conclude discussion
     */
    private async concludeDiscussion(): Promise<void> {
        log('AgenticLoop: Action C - Concluding discussion');

        const summary = await this.generateDiscussionSummary();
        
        const message: Message = {
            id: uuidv4(),
            sender: {
                id: this.moderator.getId(),
                name: this.moderator.getName(),
                role: AgentRole.MODERATOR,
                provider: this.moderator.getProviderType()
            },
            content: summary,
            timestamp: Date.now()
        };

        this.session.messages.push(message);
        this.session.updated = Date.now();
        this.notifyMessageListeners(message);
        this.setStatus(ConversationStatus.WAITING_USER);
    }

    /**
     * Get a response from a specific expert
     */
    private async getResponseFromExpertAgent(expert: ExpertAgent): Promise<void> {
        log(`AgenticLoop: Getting response from expert ${expert.getName()}`);

        try {
            const message = await expert.generateMessage(
                this.session.messages,
                true, // Stream response
                (_chunk: string) => {
                    this.notifyMessageUpdate();
                }
            );
            
            this.session.messages.push(message);
            this.session.updated = Date.now();
            this.lastResponderId = expert.getId();
            this.isFirstIteration = false;

            this.notifyMessageListeners(message);
        } catch (error) {
            log(`AgenticLoop: Error getting response from expert ${expert.getName()}: ${error}`);
        }
    }

    /**
     * Generate a discussion summary for conclusion
     */
    private async generateDiscussionSummary(): Promise<string> {
        const prompt = `Based on the conversation history, provide a concise summary of the key points and conclusions reached.

Conversation history: ${this.getRecentConversationSummary()}
User's original question: "${this.lastUserMessage}"

Provide a brief summary that captures the main insights and recommendations.`;

        try {
            const response = await this.moderator.generateMessage([{
                id: uuidv4(),
                sender: { id: 'system', name: 'System', role: AgentRole.MODERATOR },
                content: prompt,
                timestamp: Date.now()
            }], false);

            return response.content;
        } catch (error) {
            return "We've covered the key aspects of your question. Feel free to ask any follow-up questions if you need clarification on any points.";
        }
    }

    /**
     * Helper methods for parsing LLM responses
     */
    private parseUserQuestionAnsweredResponse(content: string): { answered: boolean; confidence: number } {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    answered: Boolean(parsed.answered),
                    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0))
                };
            }
        } catch (error) {
            log(`AgenticLoop: Error parsing question resolution response: ${error}`);
        }
        
        // Fallback parsing
        const contentLower = content.toLowerCase();
        const answered = contentLower.includes('true') || contentLower.includes('yes') || contentLower.includes('answered');
        const confidence = answered ? 0.7 : 0.3;
        
        return { answered, confidence };
    }

    private parseEnoughInformationResponse(content: string): { sufficient: boolean; missingInfo?: string } {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    sufficient: Boolean(parsed.sufficient),
                    missingInfo: parsed.missingInfo
                };
            }
        } catch (error) {
            log(`AgenticLoop: Error parsing information sufficiency response: ${error}`);
        }
        
        // Fallback parsing
        const contentLower = content.toLowerCase();
        const sufficient = contentLower.includes('true') || contentLower.includes('sufficient') || contentLower.includes('enough');
        
        return { sufficient };
    }

    private parseNextExpertSelectionResponse(content: string): { expertId: string; reasoning: string } {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const expertId = parsed.expertId || '';
                const reasoning = parsed.reasoning || '';
                
                // Validate that the expert ID actually exists
                const expertExists = this.experts.some(expert => expert.getId() === expertId);
                if (expertExists) {
                    return { expertId, reasoning };
                } else {
                    log(`AgenticLoop: Parsed expert ID "${expertId}" does not exist, using fallback`);
                    return this.selectFallbackExpert();
                }
            }
        } catch (error) {
            log(`AgenticLoop: Error parsing expert selection response: ${error}`);
        }
        
        return this.selectFallbackExpert();
    }

    private selectFallbackExpert(): { expertId: string; reasoning: string } {
        // Find an expert who hasn't responded recently
        const recentExpertIds = this.session.messages
            .slice(-3)
            .filter(msg => msg.sender?.role === AgentRole.EXPERT)
            .map(msg => msg.sender?.id);

        const availableExpert = this.experts.find(expert => 
            !recentExpertIds.includes(expert.getId())
        ) || this.experts[0];

        return {
            expertId: availableExpert.getId(),
            reasoning: 'Fallback selection - expert available for response'
        };
    }

    /**
     * Get recent conversation summary for context
     */
    private getRecentConversationSummary(): string {
        const recentMessages = this.session.messages.slice(-10);
        return recentMessages
            .map(msg => `${msg.sender?.name || 'Unknown'}: ${msg.content}`)
            .join('\n');
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
     * Set user satisfaction (stub for compatibility)
     * Note: In the new 2-step approach, satisfaction is determined by categorization queries
     */
    setUserSatisfaction(satisfied: boolean): void {
        // In the new 2-step approach, user satisfaction is determined by the categorization queries
        // This method is kept for compatibility but doesn't affect the loop behavior
        log(`AgenticLoop: User satisfaction set to ${satisfied} (not used in 2-step approach)`);
    }

    /**
     * Reset the loop state
     */
    reset(): void {
        this.currentTurn = 0;
        this.lastUserMessage = '';
        this.pendingUserInput = false;
        this.isFirstIteration = true;
        this.lastResponderId = '';
        this.setStatus(ConversationStatus.IDLE);
    }
} 