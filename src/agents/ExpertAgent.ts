import { BaseAgent } from './BaseAgent';
import { AgentRole, ExpertAgentConfig, Message } from '../types';
import { BaseProvider } from '../providers/BaseProvider';

/**
 * Expert agent that takes on a specific specialty role in the conversation
 */
export class ExpertAgent extends BaseAgent {
    private persona: string;
    private specialization: string;
    private color?: string;
    private avatarUrl?: string;

    constructor(
        config: ExpertAgentConfig,
        provider: BaseProvider
    ) {
        super(
            config.id,
            config.name,
            AgentRole.EXPERT,
            provider,
            config.model
        );
        this.persona = config.persona;
        this.specialization = config.specialization;
        this.color = config.color;
        this.avatarUrl = config.avatarUrl;
    }

    /**
     * Get the expert's persona description
     */
    getPersona(): string {
        return this.persona;
    }

    /**
     * Get the expert's specialization
     */
    getSpecialization(): string {
        return this.specialization;
    }

    /**
     * Get the expert's UI color
     */
    getColor(): string | undefined {
        return this.color;
    }

    /**
     * Get the expert's avatar URL
     */
    getAvatarUrl(): string | undefined {
        return this.avatarUrl;
    }

    /**
     * Format the conversation messages for the provider
     */
    protected formatMessagesForProvider(messages: Message[]): { role: string; content: string }[] {
        const formattedMessages: { role: string; content: string }[] = [];

        // Add the system message with the expert's persona
        formattedMessages.push({
            role: 'system',
            content: this.getPromptTemplate()
        });

        // Add the conversation history
        messages.forEach((message) => {
            // Map the sender role to a provider role
            let role = 'assistant';

            if (message.sender.role === AgentRole.USER) {
                role = 'user';
            } else if (message.sender.id === this.id) {
                role = 'assistant';
            } else {
                // For other experts or moderator, prefix with their name for clarity
                const prefix = `${message.sender.name}: `;
                formattedMessages.push({
                    role: 'user',
                    content: prefix + message.content
                });
                return; // Skip the normal addition below
            }

            formattedMessages.push({
                role,
                content: message.content
            });
        });

        return formattedMessages;
    }

    /**
     * Get the prompt template for this expert
     */
    protected getPromptTemplate(): string {
        return `You are ${this.name}, an AI expert specializing in ${this.specialization}.
${this.persona}

You are participating in a panel discussion with other AI experts. Each expert has their own specialty and perspective.
Your goal is to contribute your expertise to the conversation and help the user solve their problem.

When responding:
1. Stay true to your specialization and expertise
2. Be concise but thorough
3. You can reference what other experts have said by name
4. If you disagree with another expert, explain why respectfully
5. If you agree with another expert, you can build on their ideas

Remember that you are in a multi-agent conversation, and your responses should naturally flow with the discussion.`;
    }
} 