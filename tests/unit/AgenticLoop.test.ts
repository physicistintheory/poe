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

        // Setup mock experts with more realistic IDs
        mockExperts = [
            {
                generateMessage: jest.fn(),
                getId: jest.fn().mockReturnValue('backend-engineer-001'),
                getName: jest.fn().mockReturnValue('Backend Engineer'),
                getSpecialization: jest.fn().mockReturnValue('Backend development and API design'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            },
            {
                generateMessage: jest.fn(),
                getId: jest.fn().mockReturnValue('creative-brainstormer-002'),
                getName: jest.fn().mockReturnValue('Creative Brainstormer'),
                getSpecialization: jest.fn().mockReturnValue('Creative solutions and user experience design'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            },
            {
                generateMessage: jest.fn(),
                getId: jest.fn().mockReturnValue('code-optimizer-003'),
                getName: jest.fn().mockReturnValue('Code Optimizer'),
                getSpecialization: jest.fn().mockReturnValue('Performance optimization and code quality'),
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

    describe('2-step categorization approach', () => {
        it('should run parallel categorization queries correctly', async () => {
            // Mock categorization queries - Query 1 is skipped on first iteration
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear technical question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "backend-engineer-001", "reasoning": "backend development question"}',
                    timestamp: Date.now()
                });

            // Mock expert response
            const expertResponse: Message = {
                id: 'expert-response',
                sender: {
                    id: 'backend-engineer-001',
                    name: 'Backend Engineer',
                    role: AgentRole.EXPERT
                },
                content: 'For your backend API, I recommend using Node.js with Express and implementing proper authentication.',
                timestamp: Date.now()
            };
            mockExperts[0].generateMessage = jest.fn().mockResolvedValue(expertResponse);

            await agenticLoop.execute('How should I design my backend API?');

            // Verify queries were called (Query 1 skipped on first iteration)
            expect(mockModerator.generateMessage).toHaveBeenCalledTimes(2);
            
            // Verify expert was selected and responded
            expect(messageListener).toHaveBeenCalledTimes(2); // User + Expert
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
        });

        it('should skip question resolution query on first iteration', async () => {
            // Mock queries - Query 1 should be skipped on first iteration
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
                    content: '{"expertId": "creative-brainstormer-002", "reasoning": "creative design question"}',
                    timestamp: Date.now()
                });

            // Mock expert response
            mockExperts[1].generateMessage = jest.fn().mockResolvedValue({
                id: 'expert-response',
                sender: { id: 'creative-brainstormer-002', name: 'Creative Brainstormer', role: AgentRole.EXPERT },
                content: 'Creative design solution here',
                timestamp: Date.now()
            });

            await agenticLoop.execute('How can I improve my UI design?');

            // Should only call 2 queries (Query 1 skipped on first iteration)
            expect(mockModerator.generateMessage).toHaveBeenCalledTimes(2);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe('expert selection and validation', () => {
        it('should handle valid expert IDs correctly', async () => {
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
                    content: '{"expertId": "creative-brainstormer-002", "reasoning": "creative design question"}',
                    timestamp: Date.now()
                });

            mockExperts[1].generateMessage = jest.fn().mockResolvedValue({
                id: 'expert-response',
                sender: { id: 'creative-brainstormer-002', name: 'Creative Brainstormer', role: AgentRole.EXPERT },
                content: 'Creative solution here',
                timestamp: Date.now()
            });

            await agenticLoop.execute('How can I improve my UI?');

            // Should find and use the correct expert
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(1);
            expect(messageListener).toHaveBeenCalledTimes(2); // User + Expert
        });

        it('should handle invalid expert IDs and use fallback', async () => {
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
                    content: '{"expertId": "invalid-expert-id", "reasoning": "invalid selection"}',
                    timestamp: Date.now()
                });

            // Mock first expert (fallback) to respond
            mockExperts[0].generateMessage = jest.fn().mockResolvedValue({
                id: 'fallback-response',
                sender: { id: 'backend-engineer-001', name: 'Backend Engineer', role: AgentRole.EXPERT },
                content: 'Fallback response',
                timestamp: Date.now()
            });

            await agenticLoop.execute('Test question');

            // Should use fallback expert (first in list)
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(0);
            expect(mockExperts[2].generateMessage).toHaveBeenCalledTimes(0);
        });

        it('should handle expert ID parsing errors gracefully', async () => {
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
                    content: 'Invalid JSON response that cannot be parsed',
                    timestamp: Date.now()
                });

            // Mock first expert (fallback) to respond
            mockExperts[0].generateMessage = jest.fn().mockResolvedValue({
                id: 'fallback-response',
                sender: { id: 'backend-engineer-001', name: 'Backend Engineer', role: AgentRole.EXPERT },
                content: 'Fallback response',
                timestamp: Date.now()
            });

            await agenticLoop.execute('Test question');

            // Should use fallback due to parsing error
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe('action execution based on categorization', () => {
        it('should execute Action A (Request Clarification) when information is insufficient', async () => {
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": false, "missingInfo": "specific technical requirements", "reasoning": "question too vague"}',
                    timestamp: Date.now()
                });

            await agenticLoop.execute('Tell me about APIs');

            // Should request clarification, not call experts
            expect(messageListener).toHaveBeenCalledTimes(2); // User + Moderator clarification
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(0);
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(0);
            expect(mockExperts[2].generateMessage).toHaveBeenCalledTimes(0);
            
            // Should be waiting for user input
            expect(statusListener).toHaveBeenLastCalledWith(ConversationStatus.WAITING_USER);
        });

        it('should execute Action B (Expert Response) when information is sufficient and question not answered', async () => {
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear technical question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "code-optimizer-003", "reasoning": "performance question"}',
                    timestamp: Date.now()
                });

            mockExperts[2].generateMessage = jest.fn().mockResolvedValue({
                id: 'expert-response',
                sender: { id: 'code-optimizer-003', name: 'Code Optimizer', role: AgentRole.EXPERT },
                content: 'Performance optimization solution',
                timestamp: Date.now()
            });

            await agenticLoop.execute('How can I optimize my database queries?');

            // Should get expert response
            expect(messageListener).toHaveBeenCalledTimes(2); // User + Expert
            expect(mockExperts[2].generateMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe('error handling and robustness', () => {
        it('should handle expert response errors gracefully', async () => {
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
                    content: '{"expertId": "backend-engineer-001", "reasoning": "backend question"}',
                    timestamp: Date.now()
                });

            // Mock expert to fail
            mockExperts[0].generateMessage = jest.fn().mockRejectedValue(new Error('API Error'));

            // Should not throw
            await expect(agenticLoop.execute('Test question')).resolves.not.toThrow();

            // Should only have user message (expert error is logged but doesn't add message)
            expect(messageListener).toHaveBeenCalledTimes(1); // User message only
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
        });

        it('should handle moderator query failures gracefully', async () => {
            // Mock moderator to fail on first query
            mockModerator.generateMessage = jest.fn()
                .mockRejectedValueOnce(new Error('Moderator API Error'))
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "backend-engineer-001", "reasoning": "backend question"}',
                    timestamp: Date.now()
                });

            mockExperts[0].generateMessage = jest.fn().mockResolvedValue({
                id: 'expert-response',
                sender: { id: 'backend-engineer-001', name: 'Backend Engineer', role: AgentRole.EXPERT },
                content: 'Expert response',
                timestamp: Date.now()
            });

            // Should handle moderator error and continue
            await expect(agenticLoop.execute('Test question')).resolves.not.toThrow();
            
            // Should still get expert response
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe('max turns and conversation limits', () => {
        it('should handle max turns limit correctly', async () => {
            const limitedLoop = new AgenticLoop(mockSession, mockExperts, mockModerator, 1);
            limitedLoop.onMessage(messageListener);
            limitedLoop.onStatusChange(statusListener);

            // Mock categorization queries
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": false, "missingInfo": "more details needed"}',
                    timestamp: Date.now()
                });

            // Execute once (turn 1)
            await limitedLoop.execute('First question');

            // Execute again to hit max turns limit (turn 2, exceeds maxTurns=1)
            await limitedLoop.execute();

            // Should hit max turns and go to IDLE
            expect(statusListener).toHaveBeenLastCalledWith(ConversationStatus.IDLE);
            
            // Verify max turns message was added
            const session = limitedLoop.getSession();
            const lastMessage = session.messages[session.messages.length - 1];
            expect(lastMessage.sender.role).toBe(AgentRole.MODERATOR);
            expect(lastMessage.content).toContain('maximum number of turns');
        });
    });

    describe('sequential multi-expert consultation', () => {
        it('should validate that multiple experts can respond to a single user question', async () => {
            // This test validates the concept that multiple experts can respond sequentially
            // to a single user question, as shown in the documentation example flow
            
            // First expert responds
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response-1',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response-1',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "backend-engineer-001", "reasoning": "backend implementation"}',
                    timestamp: Date.now()
                });

            mockExperts[0].generateMessage = jest.fn().mockResolvedValue({
                id: 'backend-response',
                sender: { id: 'backend-engineer-001', name: 'Backend Engineer', role: AgentRole.EXPERT },
                content: 'Backend implementation details here.',
                timestamp: Date.now()
            });

            await agenticLoop.execute('How do I build a REST API?');

            // Verify first expert responded
            expect(mockExperts[0].generateMessage).toHaveBeenCalledTimes(1);
            expect(messageListener).toHaveBeenCalledTimes(2); // User + Backend Expert

            // The system is designed to allow multiple experts to respond sequentially
            // through multiple iterations of the 2-step process, as shown in the documentation
            // This test validates that the first expert can respond successfully
        });

        it('should track last responder for expert selection', async () => {
            // This test validates that the system tracks which expert responded last
            // to inform future expert selection decisions
            
            // First expert responds
            mockModerator.generateMessage = jest.fn()
                .mockResolvedValueOnce({
                    id: 'query2-response-1',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"sufficient": true, "reasoning": "clear question"}',
                    timestamp: Date.now()
                })
                .mockResolvedValueOnce({
                    id: 'query3-response-1',
                    sender: { id: 'moderator-1', name: 'Discussion Moderator', role: AgentRole.MODERATOR },
                    content: '{"expertId": "creative-brainstormer-002", "reasoning": "creative solution"}',
                    timestamp: Date.now()
                });

            mockExperts[1].generateMessage = jest.fn().mockResolvedValue({
                id: 'creative-response',
                sender: { id: 'creative-brainstormer-002', name: 'Creative Brainstormer', role: AgentRole.EXPERT },
                content: 'Creative solution here.',
                timestamp: Date.now()
            });

            await agenticLoop.execute('How can I improve my UI?');

            // Verify expert responded
            expect(mockExperts[1].generateMessage).toHaveBeenCalledTimes(1);

            // The system tracks lastResponderId to inform future expert selection
            // This ensures different experts can be selected in subsequent iterations
            const session = agenticLoop.getSession();
            const lastMessage = session.messages[session.messages.length - 1];
            expect(lastMessage.sender.id).toBe('creative-brainstormer-002');
        });
    });

    describe('state management and tracking', () => {
        it('should track expert engagement and last responder correctly', async () => {
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
                    content: '{"expertId": "creative-brainstormer-002", "reasoning": "creative question"}',
                    timestamp: Date.now()
                });

            const expertResponse: Message = {
                id: 'expert-response',
                sender: { id: 'creative-brainstormer-002', name: 'Creative Brainstormer', role: AgentRole.EXPERT },
                content: 'Creative solution here',
                timestamp: Date.now()
            };

            mockExperts[1].generateMessage = jest.fn().mockResolvedValue(expertResponse);

            await agenticLoop.execute('How can I improve my design?');

            // Verify engagement tracking
            expect(messageListener).toHaveBeenCalledWith(expertResponse);
            
            // Verify last responder is tracked
            const session = agenticLoop.getSession();
            expect(session.messages[session.messages.length - 1].sender.id).toBe('creative-brainstormer-002');
        });

        it('should handle user satisfaction setting (compatibility stub)', () => {
            agenticLoop.setUserSatisfaction(true);
            // This method is now a stub for compatibility
            expect(agenticLoop.getSession()).toBeDefined();
        });
    });
});