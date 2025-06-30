import { AgenticLoop, setAgenticLoopOutputChannel } from '../../src/orchestration/AgenticLoop';
import { ExpertAgent } from '../../src/agents/ExpertAgent';
import { ModeratorAgent } from '../../src/agents/ModeratorAgent';
import { ConversationSession, ConversationStatus, AgentRole, Message, ModeratorConfig, ProviderType } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('uuid');
jest.mock('../../src/agents/ExpertAgent');
jest.mock('../../src/agents/ModeratorAgent');

describe('AgenticLoop', () => {
    let agenticLoop: AgenticLoop;
    let mockSession: ConversationSession;
    let mockExperts: ExpertAgent[];
    let mockModerator: ModeratorAgent;
    let mockOutputChannel: any;
    let messageListener: jest.Mock;
    let statusListener: jest.Mock;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        (uuidv4 as jest.Mock).mockReturnValue('test-uuid');

        // Setup mock output channel
        mockOutputChannel = {
            appendLine: jest.fn()
        };
        setAgenticLoopOutputChannel(mockOutputChannel);

        // Setup mock session
        mockSession = {
            id: 'test-session-id',
            title: 'Test Discussion',
            goal: 'Test the agentic loop functionality',
            messages: [],
            experts: [],
            moderator: {
                id: 'test-moderator',
                name: 'Test Moderator',
                provider: ProviderType.OLLAMA,
                model: 'test-model',
                systemPrompt: 'Test moderator prompt'
            },
            isActive: true,
            autoDiscuss: true,
            maxTurns: 10,
            created: Date.now(),
            updated: Date.now()
        };

        // Setup mock experts
        mockExperts = [
            {
                generateMessage: jest.fn(),
                getId: jest.fn().mockReturnValue('expert-1'),
                getName: jest.fn().mockReturnValue('AI Expert'),
                getSpecialization: jest.fn().mockReturnValue('Artificial Intelligence'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            },
            {
                generateMessage: jest.fn(),
                getId: jest.fn().mockReturnValue('expert-2'),
                getName: jest.fn().mockReturnValue('ML Expert'),
                getSpecialization: jest.fn().mockReturnValue('Machine Learning'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            }
        ] as any;

        // Setup mock moderator
        mockModerator = {
            generateMessage: jest.fn(),
            getId: jest.fn().mockReturnValue('moderator-1'),
            getName: jest.fn().mockReturnValue('Discussion Moderator'),
            getProviderType: jest.fn().mockReturnValue('test-provider')
        } as any;

        // Create agentic loop instance
        agenticLoop = new AgenticLoop(mockSession, mockExperts, mockModerator, 10);

        // Setup listeners
        messageListener = jest.fn();
        statusListener = jest.fn();
        agenticLoop.onMessage(messageListener);
        agenticLoop.onStatusChange(statusListener);
    });

    describe('initialization', () => {
        it('should initialize with correct properties', () => {
            expect(agenticLoop.getStatus()).toBe(ConversationStatus.IDLE);
            expect(agenticLoop.getSession()).toEqual(mockSession);
        });

        it('should reset state correctly', () => {
            // Add some state
            agenticLoop.setUserSatisfaction(true);
            
            // Reset
            agenticLoop.reset();
            
            expect(agenticLoop.getStatus()).toBe(ConversationStatus.IDLE);
            expect(agenticLoop.getSession().messages).toHaveLength(0);
        });
    });

    describe('full conversation flow', () => {
        it('should handle complete flow: question -> expert answers -> follow-up -> assessment', async () => {
            // Mock expert responses for first round
            const firstExpertResponse: Message = {
                id: 'expert-1-response',
                sender: {
                    id: 'expert-1',
                    name: 'AI Expert',
                    role: AgentRole.EXPERT
                },
                content: 'AI is a broad field that includes machine learning, natural language processing, and computer vision. The key is to understand the specific problem you\'re trying to solve.',
                timestamp: Date.now()
            };

            const secondExpertResponse: Message = {
                id: 'expert-2-response',
                sender: {
                    id: 'expert-2',
                    name: 'ML Expert',
                    role: AgentRole.EXPERT
                },
                content: 'Machine learning is a subset of AI that focuses on algorithms that can learn from data. However, the choice between AI and ML depends on your specific use case.',
                timestamp: Date.now()
            };

            // Mock expert responses for second round
            const firstExpertFollowUp: Message = {
                id: 'expert-1-followup',
                sender: {
                    id: 'expert-1',
                    name: 'AI Expert',
                    role: AgentRole.EXPERT
                },
                content: 'For your specific use case, I recommend starting with a simple machine learning approach for your recommendation system. You can always scale up to more complex AI solutions later.',
                timestamp: Date.now()
            };

            const secondExpertFollowUp: Message = {
                id: 'expert-2-followup',
                sender: {
                    id: 'expert-2',
                    name: 'ML Expert',
                    role: AgentRole.EXPERT
                },
                content: 'I agree with the AI Expert. Start with supervised learning algorithms like linear regression or decision trees for your recommendation system.',
                timestamp: Date.now()
            };

            // Setup expert response mocks
            mockExperts[0].generateMessage = jest.fn()
                .mockResolvedValueOnce(firstExpertResponse)
                .mockResolvedValueOnce(firstExpertFollowUp);
            
            mockExperts[1].generateMessage = jest.fn()
                .mockResolvedValueOnce(secondExpertResponse)
                .mockResolvedValueOnce(secondExpertFollowUp);

            // Step 1: Execute with initial question
            await agenticLoop.execute('What is the difference between AI and machine learning?');

            // Verify first round of expert responses
            expect(messageListener).toHaveBeenCalledTimes(3); // User message + 2 expert responses
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.PROCESSING);
            
            // Verify expert responses were added
            const sessionAfterFirstRound = agenticLoop.getSession();
            expect(sessionAfterFirstRound.messages).toHaveLength(3);
            expect(sessionAfterFirstRound.messages[0].content).toBe('What is the difference between AI and machine learning?');
            expect(sessionAfterFirstRound.messages[1].content).toContain('AI is a broad field');
            expect(sessionAfterFirstRound.messages[2].content).toContain('Machine learning is a subset');

            // Verify expert engagement was tracked
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(1);

            // Step 2: Execute with follow-up question (simulating user response)
            messageListener.mockClear(); // Reset the mock to only count the second round
            // Reset status to IDLE to allow next round
            agenticLoop['status'] = ConversationStatus.IDLE;
            await agenticLoop.execute('I want to build a recommendation system for an e-commerce site');

            // Verify second round of expert responses
            expect(messageListener).toHaveBeenCalledTimes(3); // User message + 2 expert responses
            const sessionAfterSecondRound = agenticLoop.getSession();
            expect(sessionAfterSecondRound.messages).toHaveLength(6);
            expect(sessionAfterSecondRound.messages[3].content).toBe('I want to build a recommendation system for an e-commerce site');
            expect(sessionAfterSecondRound.messages[4].content).toContain('recommend starting with a simple machine learning');
            expect(sessionAfterSecondRound.messages[5].content).toContain('supervised learning algorithms');

            // Verify both rounds of expert responses were generated
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(2);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(2);

            // Step 3: Assess the quality of both sets of answers
            const allMessages = sessionAfterSecondRound.messages;
            
            // Assess first round answers
            const firstRoundAnswers = allMessages.filter(msg => 
                msg.sender.role === AgentRole.EXPERT && 
                [1, 2].includes(allMessages.indexOf(msg))
            );
            
            expect(firstRoundAnswers).toHaveLength(2);
            expect(firstRoundAnswers[0].content).toContain('AI is a broad field');
            expect(firstRoundAnswers[1].content).toContain('Machine learning is a subset');

            // Assess second round answers
            const secondRoundAnswers = allMessages.filter(msg => 
                msg.sender.role === AgentRole.EXPERT && 
                [4, 5].includes(allMessages.indexOf(msg))
            );
            
            expect(secondRoundAnswers).toHaveLength(2);
            expect(secondRoundAnswers[0].content).toContain('recommend starting with a simple machine learning');
            expect(secondRoundAnswers[1].content).toContain('supervised learning algorithms');

            // Verify that second round answers are more specific to the user's follow-up
            expect(secondRoundAnswers[0].content).toContain('recommendation system');
            expect(secondRoundAnswers[1].content).toContain('supervised learning');
        });

        it('should handle moderator intervention when question needs clarification', async () => {
            // Mock expert responses that indicate need for clarification
            const expertResponse1: Message = {
                id: 'expert-1-response',
                sender: {
                    id: 'expert-1',
                    name: 'AI Expert',
                    role: AgentRole.EXPERT
                },
                content: 'I need more information about your specific use case. Could you clarify what type of AI application you\'re building?',
                timestamp: Date.now()
            };

            const expertResponse2: Message = {
                id: 'expert-2-response',
                sender: {
                    id: 'expert-2',
                    name: 'ML Expert',
                    role: AgentRole.EXPERT
                },
                content: 'The approach depends on your data and requirements. What kind of data do you have available?',
                timestamp: Date.now()
            };

            const moderatorQuestion: Message = {
                id: 'moderator-question',
                sender: {
                    id: 'moderator-1',
                    name: 'Discussion Moderator',
                    role: AgentRole.MODERATOR
                },
                content: 'Could you provide more specific details about what you\'re looking for?',
                timestamp: Date.now()
            };

            // Setup mocks
            mockExperts[0].generateMessage = jest.fn().mockResolvedValue(expertResponse1);
            mockExperts[1].generateMessage = jest.fn().mockResolvedValue(expertResponse2);
            mockModerator.generateMessage = jest.fn().mockResolvedValue(moderatorQuestion);

            // Execute with vague question
            await agenticLoop.execute('Tell me about AI');

            // Verify expert responses
            expect(messageListener).toHaveBeenCalledTimes(4); // User + 2 experts + moderator
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.PROCESSING);
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.WAITING_USER);

            const session = agenticLoop.getSession();
            expect(session.messages).toHaveLength(4);
            expect(session.messages[3].sender.role).toBe(AgentRole.MODERATOR);
            expect(session.messages[3].content).toContain('specific details');
        });

        it('should assess question resolution and discussion quality', async () => {
            // Mock comprehensive expert responses
            const comprehensiveResponse1: Message = {
                id: 'expert-1-response',
                sender: {
                    id: 'expert-1',
                    name: 'AI Expert',
                    role: AgentRole.EXPERT
                },
                content: 'Here\'s a complete solution for your recommendation system: 1) Use collaborative filtering, 2) Implement content-based filtering, 3) Consider hybrid approaches. This will give you the best results.',
                timestamp: Date.now()
            };

            const comprehensiveResponse2: Message = {
                id: 'expert-2-response',
                sender: {
                    id: 'expert-2',
                    name: 'ML Expert',
                    role: AgentRole.EXPERT
                },
                content: 'I agree with the AI Expert. For e-commerce, I recommend starting with collaborative filtering using user-item matrices. Here\'s the implementation approach...',
                timestamp: Date.now()
            };

            // Setup mocks
            mockExperts[0].generateMessage = jest.fn().mockResolvedValue(comprehensiveResponse1);
            mockExperts[1].generateMessage = jest.fn().mockResolvedValue(comprehensiveResponse2);

            // Execute with specific question
            await agenticLoop.execute('How do I build a recommendation system for my e-commerce site?');

            // Verify responses
            expect(messageListener).toHaveBeenCalledTimes(3); // User + 2 experts
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.PROCESSING);

            const session = agenticLoop.getSession();
            expect(session.messages).toHaveLength(3);
            
            // Verify comprehensive answers
            expect(session.messages[1].content).toContain('complete solution');
            expect(session.messages[1].content).toContain('collaborative filtering');
            expect(session.messages[2].content).toContain('agree with the AI Expert');
            expect(session.messages[2].content).toContain('implementation approach');

            // Verify no moderator intervention needed (question well addressed)
            expect(session.messages).toHaveLength(3); // No moderator message
        });
    });

    describe('error handling', () => {
        it('should handle expert response errors gracefully', async () => {
            // Mock one expert to fail
            mockExperts[0].generateMessage = jest.fn().mockRejectedValue(new Error('API Error'));
            mockExperts[1].generateMessage = jest.fn().mockResolvedValue({
                id: 'expert-2-response',
                sender: { id: 'expert-2', name: 'ML Expert', role: AgentRole.EXPERT },
                content: 'Here is my response',
                timestamp: Date.now()
            });

            // Execute should not throw
            await expect(agenticLoop.execute('Test question')).resolves.not.toThrow();

            // Should get user, expert, and moderator messages
            expect(messageListener).toHaveBeenCalledTimes(3); // User + 1 expert + moderator
            const calls = messageListener.mock.calls.map(call => call[0]);
            expect(calls[0].sender.role).toBe(AgentRole.USER);
            expect(calls[1].sender.role).toBe(AgentRole.EXPERT);
            expect(calls[2].sender.role).toBe(AgentRole.MODERATOR);
            expect(calls[2].content).toContain('discussion quality has declined');
        });

        it('should handle max turns limit', async () => {
            // Create loop with very low max turns
            const limitedLoop = new AgenticLoop(mockSession, mockExperts, mockModerator, 1);
            limitedLoop.onMessage(messageListener);
            limitedLoop.onStatusChange(statusListener);

            // Mock expert responses
            mockExperts[0].generateMessage = jest.fn().mockResolvedValue({
                id: 'expert-response',
                sender: { id: 'expert-1', name: 'AI Expert', role: AgentRole.EXPERT },
                content: 'Test response',
                timestamp: Date.now()
            });

            // Execute once to hit limit
            await limitedLoop.execute('First question');

            // Should terminate after max turns
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.WAITING_USER);
        });
    });

    describe('state management', () => {
        it('should track expert engagement correctly', async () => {
            const highQualityResponse: Message = {
                id: 'expert-response',
                sender: { id: 'expert-1', name: 'AI Expert', role: AgentRole.EXPERT },
                content: 'This is a comprehensive answer that addresses the question thoroughly with specific solutions and recommendations.',
                timestamp: Date.now()
            };

            mockExperts[0].generateMessage = jest.fn().mockResolvedValue(highQualityResponse);

            await agenticLoop.execute('Test question');

            // Verify engagement tracking
            expect(messageListener).toHaveBeenCalledWith(highQualityResponse);
        });

        it('should handle user satisfaction setting', () => {
            agenticLoop.setUserSatisfaction(true);
            // This would affect loop continuation in real scenarios
            expect(agenticLoop.getSession()).toBeDefined();
        });
    });
}); 