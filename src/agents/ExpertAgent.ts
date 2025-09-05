import { BaseAgent } from './BaseAgent';
import { AgentRole, ExpertAgentConfig, Message } from '../types';
import { BaseProvider } from '../providers/BaseProvider';
import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;
export function setExpertAgentOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel;
}

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
                // Add length constraint reminder to every user message
                const contentWithConstraint = `${message.content}\n\nIMPORTANT: Respond in 2-3 sentences maximum.`;
                formattedMessages.push({
                    role,
                    content: contentWithConstraint
                });
            } else if (message.sender.id === this.id) {
                role = 'assistant';
                formattedMessages.push({
                    role,
                    content: message.content
                });
            } else {
                // For other experts or moderator, prefix with their name for clarity
                const prefix = `${message.sender.name}: `;
                formattedMessages.push({
                    role: 'user',
                    content: prefix + message.content
                });
                return; // Skip the normal addition below
            }
        });

        // Add a final reminder about length constraint
        formattedMessages.push({
            role: 'user',
            content: 'REMINDER: Keep your response to 2-3 sentences maximum. This is a strict requirement.'
        });

        return formattedMessages;
    }

    /**
     * Truncate response to maximum 3 sentences
     */
    private truncateToMaxSentences(content: string): string {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length <= 3) {
            return content;
        }
        
        // Take first 3 sentences and add proper punctuation
        const truncated = sentences.slice(0, 3).map(s => s.trim()).join('. ').trim();
        return truncated + (truncated.endsWith('.') ? '' : '.');
    }

    /**
     * Override generateMessage to enforce length constraint and add timing logs
     */
    async generateMessage(
        messages: Message[],
        asStream: boolean = false,
        callback?: (chunk: string, done: boolean) => void
    ): Promise<Message> {
        const callId = Math.random().toString(36).substr(2, 9); // Generate unique call ID
        
        if (outputChannel) {
            outputChannel.appendLine(`🕐 ${this.name} starting message generation [${callId}] at ${new Date().toISOString()}`);
        }
        
        try {
            // Time just the LLM call, not the entire message generation
            const llmStartTime = Date.now();
            
            if (outputChannel) {
                outputChannel.appendLine(`🔄 ${this.name} starting LLM call [${callId}] at ${new Date().toISOString()}`);
            }
            
            const message = await super.generateMessage(messages, asStream, callback);
            
            const llmEndTime = Date.now();
            const llmDuration = llmEndTime - llmStartTime;
            
            if (outputChannel) {
                outputChannel.appendLine(`✅ ${this.name} LLM call [${callId}] completed in ${llmDuration}ms (start: ${llmStartTime}, end: ${llmEndTime})`);
            }
            
            // Post-process to ensure response is within length limits
            if (!asStream) {
                message.content = this.truncateToMaxSentences(message.content);
            }
            
            if (outputChannel) {
                outputChannel.appendLine(`✅ ${this.name} message generation [${callId}] completed`);
            }
            
            return message;
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine(`❌ ${this.name} message generation [${callId}] failed: ${error}`);
            }
            
            throw error;
        }
    }

    /**
     * Get the prompt template for this expert
     */
    protected getPromptTemplate(): string {
        return `You are ${this.name}, an AI expert specializing in ${this.specialization}.
${this.persona}

You are participating in a panel discussion with other AI experts. Each expert has their own specialty and perspective.
Your goal is to contribute your expertise to the conversation and help the user solve their problem.

🚨 CRITICAL RESPONSE RULE: You MUST keep responses to 2-3 sentences maximum. NEVER exceed 3 sentences.

When responding:
1. Stay true to your specialization and expertise
2. KEEP RESPONSES SHORT: 2-3 sentences maximum - this is non-negotiable
3. Be direct and concise - no unnecessary elaboration
4. You can reference what other experts have said by name
5. If you disagree with another expert, explain why briefly
6. If you agree with another expert, build on their ideas concisely

CRITICAL: Count your sentences before responding. If you exceed 3 sentences, you will be penalized.
Your response must be brief, focused, and to the point.

REMEMBER: MAXIMUM 3 SENTENCES. NO EXCEPTIONS.`;
    }
} 