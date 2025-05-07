import { v4 as uuidv4 } from 'uuid';
import { AgentRole, Message, ProviderType } from '../types';
import { BaseProvider } from '../providers/BaseProvider';

/**
 * Base agent class that handles conversation with an LLM
 */
export abstract class BaseAgent {
    protected id: string;
    protected name: string;
    protected role: AgentRole;
    protected provider: BaseProvider;
    protected model: string;
    protected history: Message[] = [];

    constructor(
        id: string | undefined,
        name: string,
        role: AgentRole,
        provider: BaseProvider,
        model: string
    ) {
        this.id = id || uuidv4();
        this.name = name;
        this.role = role;
        this.provider = provider;
        this.model = model;
    }

    /**
     * Get the agent's ID
     */
    getId(): string {
        return this.id;
    }

    /**
     * Get the agent's name
     */
    getName(): string {
        return this.name;
    }

    /**
     * Get the agent's role
     */
    getRole(): AgentRole {
        return this.role;
    }

    /**
     * Get the provider's type
     */
    getProviderType(): ProviderType {
        return this.provider.getProviderType();
    }

    /**
     * Format the conversation messages for the provider
     * @param messages The conversation messages
     */
    protected abstract formatMessagesForProvider(messages: Message[]): { role: string; content: string }[];

    /**
     * Get a prompt template for this agent's role
     */
    protected abstract getPromptTemplate(): string;

    /**
     * Generate a message from this agent based on the conversation
     * @param messages The conversation so far
     * @param asStream Whether to stream the response
     * @param callback Optional callback for streaming responses
     */
    async generateMessage(
        messages: Message[],
        asStream: boolean = false,
        callback?: (chunk: string, done: boolean) => void
    ): Promise<Message> {
        // Store the conversation history
        this.history = [...messages];

        // Format the messages for the provider
        const formattedMessages = this.formatMessagesForProvider(messages);

        // Create a new message object
        const newMessage: Message = {
            id: uuidv4(),
            sender: {
                id: this.id,
                name: this.name,
                role: this.role,
                provider: this.provider.getProviderType()
            },
            content: '',
            timestamp: Date.now(),
            isStreaming: asStream
        };

        if (asStream && callback) {
            // For streaming, we'll update the message content via the callback
            let messageContent = '';

            await this.provider.generateStreamingCompletion(
                formattedMessages,
                (chunk, done) => {
                    messageContent += chunk;
                    newMessage.content = messageContent;
                    callback(chunk, done);

                    if (done) {
                        newMessage.isStreaming = false;
                    }
                },
                this.model
            );

            return newMessage;
        } else {
            // For non-streaming, get the full response at once
            const response = await this.provider.generateCompletion(
                formattedMessages,
                this.model
            );

            newMessage.content = response.content;
            return newMessage;
        }
    }
} 