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
            },
            {
                generateMessage: jest.fn(),
                getId: jest.fn().mockReturnValue('expert-3'),
                getName: jest.fn().mockReturnValue('Data Scientist'),
                getSpecialization: jest.fn().mockReturnValue('Data Science'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            }
        ] as any;

        // Setup mock moderator
        mockModerator = {
            generateMessage: jest.fn().mockResolvedValue({
                id: 'moderator-response',
                sender: {
                    id: 'moderator-1',
                    name: 'Discussion Moderator',
                    role: AgentRole.MODERATOR
                },
                content: 'Could you please provide more specific details about what you\'re looking for?',
                timestamp: Date.now()
            }),
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
        it('should handle sequential expert responses with moderator decisions', async () => {
            // Mock expert responses in sequence
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
                content: 'I agree with the AI Expert about the broad scope. However, machine learning specifically focuses on algorithms that can learn from data, which is often the most practical starting point.',
                timestamp: Date.now()
            };

            const thirdExpertResponse: Message = {
                id: 'expert-3-response',
                sender: {
                    id: 'expert-3',
                    name: 'Data Scientist',
                    role: AgentRole.EXPERT
                },
                content: 'Both experts make good points. For implementation, I\'d recommend starting with ML since it\'s more accessible and has proven results. You can always expand to broader AI later.',
                timestamp: Date.now()
            };

            // In the new 2-step approach, mock categorization to get expert response
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "expert-1", "reasoning": "AI Expert best suited"}',
                    timestamp: Date.now()
                });

            // Setup expert response mock
            mockExperts[0].generateMessage = jest.fn().mockResolvedValue(firstExpertResponse);

            // Execute with initial question
            await agenticLoop.execute('What is the difference between AI and machine learning?');

            // Verify expert response was added
            const sessionAfterFirstExpert = agenticLoop.getSession();
            expect(sessionAfterFirstExpert.messages.length).toBe(2);
            expect(sessionAfterFirstExpert.messages[0].content).toBe('What is the difference between AI and machine learning?');
            expect(sessionAfterFirstExpert.messages[1].content).toContain('AI is a broad field');

            // Verify only selected expert was called
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(0);
            expect(mockExperts[2].generateMessage).toHaveBeenCalledTimes(0);

            // Verify status progression
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.PROCESSING);
        });

        it('should handle moderator intervention when question needs clarification', async () => {
            // In the new 2-step approach, if information is insufficient, moderator asks for clarification
            // Mock the moderator's Query 2 to return "insufficient information"
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": false, "missingInfo": "more specific details about your AI needs", "reasoning": "question is too vague"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'moderator-question',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: 'To provide you with the best possible answer, could you please clarify: more specific details about your AI needs',
                    timestamp: Date.now()
                });

            // Execute with vague question
            await agenticLoop.execute('Tell me about AI');

            // In the new 2-step approach: User message + Moderator clarification request
            expect(messageListener).toHaveBeenCalledTimes(2); // User + moderator clarification
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.PROCESSING);
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.WAITING_USER);

            const session = agenticLoop.getSession();
            expect(session.messages.length).toBe(2);
            expect(session.messages[0].sender.role).toBe(AgentRole.USER);
            expect(session.messages[1].sender.role).toBe(AgentRole.MODERATOR);
            expect(session.messages[1].content).toContain('could you please clarify');

            // In the new approach, no experts are called if information is insufficient
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(0);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(0);
        });

        it('should assess question resolution and discussion quality', async () => {
            // In the new 2-step approach, mock the categorization queries
            // Query 2: Information sufficient, Query 3: Select first expert
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear specific question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "expert-1", "reasoning": "AI Expert best suited for recommendation systems"}',
                    timestamp: Date.now()
                });

            // Mock expert response
            const expertResponse: Message = {
                id: 'expert-1-response',
                sender: {
                    id: 'expert-1',
                    name: 'AI Expert',
                    role: AgentRole.EXPERT
                },
                content: 'Here\'s a complete solution for your recommendation system: 1) Use collaborative filtering, 2) Implement content-based filtering, 3) Consider hybrid approaches. This will give you the best results.',
                timestamp: Date.now()
            };

            mockExperts[0].generateMessage = jest.fn().mockResolvedValue(expertResponse);

            // Execute with specific question
            await agenticLoop.execute('How do I build a recommendation system for my e-commerce site?');

            // In the new 2-step approach: User message + Expert response
            expect(messageListener).toHaveBeenCalledTimes(2); // User + expert response
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.PROCESSING);

            const session = agenticLoop.getSession();
            expect(session.messages.length).toBe(2);
            
            // Verify expert response
            expect(session.messages[0].sender.role).toBe(AgentRole.USER);
            expect(session.messages[1].sender.role).toBe(AgentRole.EXPERT);
            expect(session.messages[1].content).toContain('complete solution');
            expect(session.messages[1].content).toContain('collaborative filtering');

            // Verify the selected expert was called
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(0);
        });

        it('should pause expert responses when moderator asks follow-up question', async () => {
            // In the new 2-step approach, test the same scenario as the clarification test
            // Mock the moderator's Query 2 to return "insufficient information"
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": false, "missingInfo": "specific AI application details", "reasoning": "question is too vague"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'moderator-question',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: 'To provide you with the best possible answer, could you please clarify: specific AI application details',
                    timestamp: Date.now()
                });

            // Execute with vague question
            await agenticLoop.execute('Tell me about AI');

            // In the new 2-step approach: User message + Moderator clarification request
            expect(messageListener).toHaveBeenCalledTimes(2); // User + moderator clarification
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.PROCESSING);
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.WAITING_USER);

            const session = agenticLoop.getSession();
            expect(session.messages).toHaveLength(2);
            expect(session.messages[0].sender.role).toBe(AgentRole.USER);
            expect(session.messages[1].sender.role).toBe(AgentRole.MODERATOR);
            expect(session.messages[1].content).toContain('could you please clarify');

            // In the new approach, no experts are called if information is insufficient
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(0);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(0);

            // Step 2: Try to continue the conversation without user input
            messageListener.mockClear();
            agenticLoop.reset(); // Reset to idle state
            await agenticLoop.execute(); // No new user message

            // Should hit max turns logic and stay idle since no user message
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.IDLE);
        });
    });

    describe('error handling', () => {
        it('should handle expert response errors gracefully', async () => {
            // In the new 2-step approach, mock categorization queries to select an expert that will fail
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "expert-1", "reasoning": "first expert selected"}',
                    timestamp: Date.now()
                });

            // Mock first expert to fail
            mockExperts[0].generateMessage = jest.fn().mockRejectedValue(new Error('API Error'));

            // Execute should not throw
            await expect(agenticLoop.execute('Test question')).resolves.not.toThrow();

            // Should get user message only (expert error is logged but doesn't add message)
            expect(messageListener).toHaveBeenCalledTimes(1); // User message only
            const calls = messageListener.mock.calls.map(call => call[0]);
            expect(calls[0].sender.role).toBe(AgentRole.USER);

            // Verify the expert was called and failed
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
        });

        it('should handle max turns limit', async () => {
            // Create loop with max turns of 1
            const limitedLoop = new AgenticLoop(mockSession, mockExperts, mockModerator, 1);
            limitedLoop.onMessage(messageListener);
            limitedLoop.onStatusChange(statusListener);

            // Mock categorization queries for first execution
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": false, "missingInfo": "more details needed"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'moderator-question',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: 'Could you provide more details?',
                    timestamp: Date.now()
                });

            // Execute once (turn 1)
            await limitedLoop.execute('First question');

            // Execute again to hit max turns limit (turn 2, exceeds maxTurns=1)
            await limitedLoop.execute();

            // Should hit max turns and go to IDLE (after showing max turns message)
            expect(statusListener).toHaveBeenLastCalledWith(ConversationStatus.IDLE);
            
            // Verify max turns message was added
            const session = limitedLoop.getSession();
            const lastMessage = session.messages[session.messages.length - 1];
            expect(lastMessage.sender.role).toBe(AgentRole.MODERATOR);
            expect(lastMessage.content).toContain('maximum number of turns');
        });
    });

    describe('state management', () => {
        it('should track expert engagement correctly', async () => {
            // Mock categorization to select expert
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "expert-1", "reasoning": "first expert selected"}',
                    timestamp: Date.now()
                });

            const highQualityResponse: Message = {
                id: 'expert-response',
                sender: { id: 'expert-1', name: 'AI Expert', role: AgentRole.EXPERT },
                content: 'This is a comprehensive answer that addresses the question thoroughly with specific solutions and recommendations.',
                timestamp: Date.now()
            };

            mockExperts[0].generateMessage = jest.fn().mockResolvedValue(highQualityResponse);

            await agenticLoop.execute('Test question');

            // Verify engagement tracking - expert message should be called
            expect(messageListener).toHaveBeenCalledWith(highQualityResponse);
        });

        it('should handle user satisfaction setting', () => {
            agenticLoop.setUserSatisfaction(true);
            // This would affect loop continuation in real scenarios
            expect(agenticLoop.getSession()).toBeDefined();
        });
    });
}); 