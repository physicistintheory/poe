import { BaseAgent } from './BaseAgent';
import { AgentRole, Message, ModeratorConfig } from '../types';
import { BaseProvider } from '../providers/BaseProvider';

/**
 * Moderator agent that guides and focuses the conversation
 */
export class ModeratorAgent extends BaseAgent {
    private systemPrompt: string;
    private interventionThreshold: number;
    private goal: string = '';

    constructor(
        config: ModeratorConfig,
        provider: BaseProvider
    ) {
        super(
            config.id,
            config.name,
            AgentRole.MODERATOR,
            provider,
            config.model
        );
        this.systemPrompt = config.systemPrompt;
        this.interventionThreshold = config.interventionThreshold || 0.7;
    }

    /**
     * Set the goal of the conversation for the moderator to track
     */
    setGoal(goal: string): void {
        this.goal = goal;
    }

    /**
     * Get the moderator's system prompt
     */
    getSystemPrompt(): string {
        return this.systemPrompt;
    }

    /**
     * Get the intervention threshold
     */
    getInterventionThreshold(): number {
        return this.interventionThreshold;
    }

    /**
     * Format the conversation messages for the provider
     */
    protected formatMessagesForProvider(messages: Message[]): { role: string; content: string }[] {
        const formattedMessages: { role: string; content: string }[] = [];

        // Add the system message with the moderator's prompt
        formattedMessages.push({
            role: 'system',
            content: this.getPromptTemplate()
        });

        // Add the conversation history with clear speaker labels
        messages.forEach((message) => {
            formattedMessages.push({
                role: 'user',
                content: `${message.sender.name} (${message.sender.role}): ${message.content}`
            });
        });

        // Add a final prompt asking the moderator to intervene or summarize
        formattedMessages.push({
            role: 'user',
            content: `Based on the conversation above, decide if you need to:
1. Guide the discussion if it's off-topic
2. Ask follow-up questions to experts if details are missing
3. Summarize key points so far
4. Suggest a conclusion if the goal seems met
5. Stay silent if the discussion is productive and on track

Respond in your role as the Moderator. Goal: ${this.goal}`
        });

        return formattedMessages;
    }

    /**
     * Check if the conversation needs moderation
     * @param messages The conversation messages
     */
    async shouldIntervene(messages: Message[]): Promise<boolean> {
        // If fewer than 3 messages, or last message was from moderator, don't intervene
        if (messages.length < 3 || messages[messages.length - 1].sender.role === AgentRole.MODERATOR) {
            return false;
        }

        // Get the last few messages to analyze
        const recentMessages = messages.slice(-5);

        // Format messages for the provider
        const formattedMessages = this.formatMessagesForProvider(recentMessages);

        // Add a specific moderation check prompt
        formattedMessages.push({
            role: 'user',
            content: `Based on the recent messages, does the conversation need moderation? 
The conversation goal is: ${this.goal}
Answer with a number between 0 and 1, where 0 means no moderation needed and 1 means urgent moderation needed.`
        });

        // Get LLM response
        const response = await this.provider.generateCompletion(formattedMessages, this.model);

        try {
            // Try to extract a number from the response
            const match = response.content.match(/([0-9]*[.])?[0-9]+/);

            if (match) {
                const score = parseFloat(match[0]);
                return score >= this.interventionThreshold;
            }
        } catch (error) {
            console.error('Error parsing moderation score:', error);
        }

        // Default to false if we can't determine
        return false;
    }

    /**
     * Get the prompt template for the moderator
     */
    protected getPromptTemplate(): string {
        return `You are ${this.name}, an AI moderator whose job is to guide a panel discussion between multiple AI experts.
${this.systemPrompt}

The current goal of the conversation is: ${this.goal}

As a moderator, your responsibilities are:
1. Keep the discussion focused on the goal/question at hand
2. Ensure balanced participation from all experts
3. Identify when the discussion has gone off-track and redirect it
4. Ask clarifying questions when needed
5. Summarize key points periodically
6. Suggest when a conclusion might be reached
7. Remain neutral and don't contribute domain expertise yourself

You may intervene when:
- The conversation goes off-topic
- Experts are talking past each other
- Important aspects of the problem are being missed
- A logical conclusion has been reached
- The discussion has stagnated

Be concise, clear, and facilitating rather than dominating. Your role is to guide, not to solve the problem directly.`;
    }
} 