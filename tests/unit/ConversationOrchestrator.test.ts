import { ConversationOrchestrator } from '../../src/orchestration/ConversationOrchestrator';
import { ExpertAgent } from '../../src/agents/ExpertAgent';
import { ModeratorAgent } from '../../src/agents/ModeratorAgent';
import { BaseProvider } from '../../src/providers/BaseProvider';
import { ConversationStatus, AgentRole, Message } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('uuid');
jest.mock('../../src/agents/ExpertAgent');
jest.mock('../../src/agents/ModeratorAgent');

describe('ConversationOrchestrator', () => {
    let orchestrator: ConversationOrchestrator;
    let mockProvider: BaseProvider;
    let mockExpertConfig: any;
    let mockModeratorConfig: any;
    let mockProviderMap: Map<string, BaseProvider>;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        (uuidv4 as jest.Mock).mockReturnValue('test-uuid');

        // Setup mock provider
        mockProvider = {
            generateResponse: jest.fn(),
            streamResponse: jest.fn(),
            getType: jest.fn().mockReturnValue('test-provider')
        } as any;

        // Setup mock configurations
        mockExpertConfig = {
            name: 'Test Expert',
            provider: 'test-provider',
            role: AgentRole.EXPERT
        };

        mockModeratorConfig = {
            name: 'Test Moderator',
            provider: 'test-provider',
            role: AgentRole.MODERATOR
        };

        mockProviderMap = new Map([
            ['test-provider', mockProvider]
        ]);

        // Create orchestrator instance
        orchestrator = new ConversationOrchestrator(
            {},
            [mockExpertConfig],
            mockModeratorConfig,
            mockProviderMap
        );
    });

    describe('initialization', () => {
        it('should initialize with default values', () => {
            const session = orchestrator.getSession();
            expect(session.id).toBe('test-uuid');
            expect(session.title).toBe('New Discussion');
            expect(session.goal).toBe('');
            expect(session.messages).toEqual([]);
            expect(session.experts).toEqual([mockExpertConfig]);
            expect(session.moderator).toEqual(mockModeratorConfig);
            expect(session.isActive).toBe(false);
            expect(session.autoDiscuss).toBe(false);
            expect(session.maxTurns).toBe(50);
        });

        it('should initialize with custom values', () => {
            const customConfig = {
                id: 'custom-id',
                title: 'Custom Title',
                goal: 'Test Goal',
                autoDiscuss: true,
                maxTurns: 30
            };

            const customOrchestrator = new ConversationOrchestrator(
                customConfig,
                [mockExpertConfig],
                mockModeratorConfig,
                mockProviderMap
            );

            const session = customOrchestrator.getSession();
            expect(session.id).toBe('custom-id');
            expect(session.title).toBe('Custom Title');
            expect(session.goal).toBe('Test Goal');
            expect(session.autoDiscuss).toBe(true);
            expect(session.maxTurns).toBe(30);
        });

        it('should throw error if provider not found for expert', () => {
            const invalidProviderMap = new Map();
            expect(() => {
                new ConversationOrchestrator(
                    {},
                    [mockExpertConfig],
                    mockModeratorConfig,
                    invalidProviderMap
                );
            }).toThrow(`Provider ${mockExpertConfig.provider} not found for expert ${mockExpertConfig.name}`);
        });

        it('should throw error if provider not found for moderator', () => {
            const invalidProviderMap = new Map();
            // Add expert provider but not moderator provider
            invalidProviderMap.set('test-provider', mockProvider);
            expect(() => {
                new ConversationOrchestrator(
                    {},
                    [mockExpertConfig],
                    { ...mockModeratorConfig, provider: 'different-provider' },
                    invalidProviderMap
                );
            }).toThrow(`Provider different-provider not found for moderator`);
        });
    });

    describe('message handling', () => {
        it('should add user message and notify listeners', async () => {
            const messageListener = jest.fn();
            orchestrator.onMessage(messageListener);

            await orchestrator.addUserMessage('Hello, experts!');

            const session = orchestrator.getSession();
            expect(session.messages).toHaveLength(1);
            expect(session.messages[0].content).toBe('Hello, experts!');
            expect(session.messages[0].sender.role).toBe(AgentRole.USER);
            expect(messageListener).toHaveBeenCalledWith(session.messages[0]);
        });

        it('should start next round when auto-discuss is enabled', async () => {
            orchestrator.setAutoDiscuss(true);
            const statusListener = jest.fn();
            orchestrator.onStatusChange(statusListener);

            await orchestrator.addUserMessage('Hello, experts!');

            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.PROCESSING);
        });
    });

    describe('status management', () => {
        it('should update status and notify listeners', async () => {
            const statusListener = jest.fn();
            orchestrator.onStatusChange(statusListener);

            await orchestrator.addUserMessage('Hello, experts!');
            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.WAITING_USER);
        });

        it('should get current status', () => {
            expect(orchestrator.getStatus()).toBe(ConversationStatus.IDLE);
        });
    });

    describe('session management', () => {
        it('should update goal', () => {
            const newGoal = 'New discussion goal';
            orchestrator.setGoal(newGoal);
            expect(orchestrator.getSession().goal).toBe(newGoal);
        });

        it('should reset conversation', () => {
            // Add some messages first
            orchestrator.addUserMessage('Test message');
            expect(orchestrator.getSession().messages).toHaveLength(1);

            // Reset
            orchestrator.reset();
            expect(orchestrator.getSession().messages).toHaveLength(0);
            expect(orchestrator.getStatus()).toBe(ConversationStatus.IDLE);
        });
    });

    describe('conversation flow', () => {
        let orchestrator: ConversationOrchestrator;
        beforeEach(() => {
            // Mock ExpertAgent and ModeratorAgent methods
            (ExpertAgent as jest.Mock).mockImplementation(() => ({
                generateMessage: jest.fn().mockResolvedValue({
                    id: 'expert-message-id',
                    sender: { id: 'expert-1', name: 'Test Expert', role: AgentRole.EXPERT },
                    content: 'Expert response',
                    timestamp: Date.now()
                }),
                getId: jest.fn().mockReturnValue('expert-1'),
                getName: jest.fn().mockReturnValue('Test Expert'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            }));

            (ModeratorAgent as jest.Mock).mockImplementation(() => ({
                generateMessage: jest.fn().mockResolvedValue({
                    id: 'moderator-message-id',
                    sender: { id: 'mod-1', name: 'Test Moderator', role: AgentRole.MODERATOR },
                    content: 'Moderator response',
                    timestamp: Date.now()
                }),
                shouldIntervene: jest.fn().mockResolvedValue(true),
                setGoal: jest.fn(),
                getId: jest.fn().mockReturnValue('mod-1'),
                getName: jest.fn().mockReturnValue('Test Moderator'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            }));

            // Create orchestrator after mocks
            orchestrator = new ConversationOrchestrator(
                {},
                [mockExpertConfig],
                mockModeratorConfig,
                mockProviderMap
            );
        });

        it('should get responses from all experts in a round', async () => {
            await orchestrator.addUserMessage('Hello, experts!');
            await orchestrator.startNextRound();

            const session = orchestrator.getSession();
            expect(session.messages).toHaveLength(3); // User message + Expert response + Moderator response
            expect(session.messages[1].sender.role).toBe(AgentRole.EXPERT);
            expect(session.messages[2].sender.role).toBe(AgentRole.MODERATOR);
        });

        it('should get moderator response when intervention is needed', async () => {
            await orchestrator.addUserMessage('Hello, experts!');
            await orchestrator.startNextRound();

            const session = orchestrator.getSession();
            expect(session.messages).toHaveLength(3); // User message + Expert response + Moderator response
            expect(session.messages[2].sender.role).toBe(AgentRole.MODERATOR);
        });

        it('should not get moderator response when no intervention is needed', async () => {
            // Mock moderator to not intervene
            (ModeratorAgent as jest.Mock).mockImplementation(() => ({
                generateMessage: jest.fn().mockResolvedValue({
                    id: 'moderator-message-id',
                    sender: { id: 'mod-1', name: 'Test Moderator', role: AgentRole.MODERATOR },
                    content: 'Moderator response',
                    timestamp: Date.now()
                }),
                shouldIntervene: jest.fn().mockResolvedValue(false),
                setGoal: jest.fn(),
                getId: jest.fn().mockReturnValue('mod-1'),
                getName: jest.fn().mockReturnValue('Test Moderator'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            }));
            // Re-create orchestrator after new mock
            orchestrator = new ConversationOrchestrator(
                {},
                [mockExpertConfig],
                mockModeratorConfig,
                mockProviderMap
            );

            await orchestrator.addUserMessage('Hello, experts!');
            await orchestrator.startNextRound();

            const session = orchestrator.getSession();
            expect(session.messages).toHaveLength(2); // User message + Expert response only
        });

        it('should stop after reaching max turns', async () => {
            orchestrator.setMaxTurns(1);
            await orchestrator.addUserMessage('Hello, experts!');
            await orchestrator.startNextRound();
            // Call again to trigger wrap-up
            await orchestrator.startNextRound();

            const session = orchestrator.getSession();
            expect(session.messages).toHaveLength(4); // User message + Expert response + Moderator + wrap-up
            expect(session.messages[3].content).toContain('maximum number of turns');
            expect(orchestrator.getStatus()).toBe(ConversationStatus.IDLE);
        });

        it('should handle errors during conversation round', async () => {
            // Mock expert to throw error
            (ExpertAgent as jest.Mock).mockImplementation(() => ({
                generateMessage: jest.fn().mockRejectedValue(new Error('Test error')),
                getId: jest.fn().mockReturnValue('expert-1'),
                getName: jest.fn().mockReturnValue('Test Expert'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            }));
            // Re-create orchestrator after new mock
            orchestrator = new ConversationOrchestrator(
                {},
                [mockExpertConfig],
                mockModeratorConfig,
                mockProviderMap
            );

            const statusListener = jest.fn();
            orchestrator.onStatusChange(statusListener);

            await orchestrator.addUserMessage('Hello, experts!');
            await orchestrator.startNextRound();

            expect(statusListener).toHaveBeenCalledWith(ConversationStatus.ERROR);
        });

        it('should handle streaming updates', async () => {
            const messageListener = jest.fn();
            // Mock streaming updates
            let streamCallback: (() => void) | undefined;
            (ExpertAgent as jest.Mock).mockImplementation(() => ({
                generateMessage: jest.fn().mockImplementation((_, __, onStream) => {
                    streamCallback = onStream;
                    return Promise.resolve({
                        id: 'expert-message-id',
                        sender: { id: 'expert-1', name: 'Test Expert', role: AgentRole.EXPERT },
                        content: 'Expert response',
                        timestamp: Date.now()
                    });
                }),
                getId: jest.fn().mockReturnValue('expert-1'),
                getName: jest.fn().mockReturnValue('Test Expert'),
                getProviderType: jest.fn().mockReturnValue('test-provider')
            }));
            // Re-create orchestrator after new mock
            orchestrator = new ConversationOrchestrator(
                {},
                [mockExpertConfig],
                mockModeratorConfig,
                mockProviderMap
            );
            orchestrator.onMessage(messageListener);

            await orchestrator.addUserMessage('Hello, experts!');
            await orchestrator.startNextRound();

            // Simulate streaming updates
            if (streamCallback) {
                streamCallback();
            }

            expect(messageListener.mock.calls.length).toBeGreaterThanOrEqual(4); // At least one for each message and one for stream update
        });
    });
}); 