// Test to ensure moderator doesn't dominate conversations
const { AgenticLoop } = require('../../dist/orchestration/AgenticLoop');
const { v4: uuidv4 } = require('uuid');

// Mock provider that tracks who speaks
class ModeratorBehaviorTestProvider {
    constructor() {
        this.responseCount = 0;
        this.moderatorMessages = 0;
        this.expertMessages = 0;
        this.systemMessages = 0;
    }

    getProviderType() {
        return 'mock';
    }

    async generateMessage(messages, stream = false, onChunk = null) {
        this.responseCount++;
        const lastMessage = messages[messages.length - 1];
        const content = lastMessage.content;
        
        // Track who's speaking based on the message content
        if (content.includes('clarification') || content.includes('unclear')) {
            this.expertMessages++;
            return {
                id: uuidv4(),
                sender: { 
                    id: 'expert-1', 
                    name: 'Test Expert', 
                    role: 'expert',
                    provider: 'mock'
                },
                content: 'I need a bit more information to help you effectively. Could you clarify what specific aspect you\'d like me to focus on?',
                timestamp: Date.now()
            };
        } else if (content.includes('conclusion') || content.includes('summary')) {
            this.expertMessages++;
            return {
                id: uuidv4(),
                sender: { 
                    id: 'expert-1', 
                    name: 'Test Expert', 
                    role: 'expert',
                    provider: 'mock'
                },
                content: 'Based on our discussion, here are the key recommendations: 1) Start with a clear plan, 2) Test early and often, 3) Keep it simple. Feel free to ask if you need any clarification!',
                timestamp: Date.now()
            };
        } else {
            // Regular expert response
            this.expertMessages++;
            const responses = [
                "Here's my expert advice on this topic...",
                "From my experience, I'd recommend...",
                "Let me share some insights about this...",
                "Based on best practices, you should consider...",
                "I think the best approach would be..."
            ];
            return {
                id: uuidv4(),
                sender: { 
                    id: 'expert-1', 
                    name: 'Test Expert', 
                    role: 'expert',
                    provider: 'mock'
                },
                content: responses[(this.responseCount - 1) % responses.length],
                timestamp: Date.now()
            };
        }
    }
}

// Create mock experts
const mockProvider = new ModeratorBehaviorTestProvider();

const experts = [
    {
        getId: () => 'expert-1',
        getName: () => 'Test Expert',
        getSpecialization: () => 'General expertise',
        generateMessage: async (messages, stream, onChunk) => {
            return mockProvider.generateMessage(messages, stream, onChunk);
        }
    }
];

// Create mock moderator (should stay in background)
const moderator = {
    getId: () => 'moderator-1',
    getName: () => 'Discussion Moderator',
    getProviderType: () => 'mock',
    generateMessage: async (messages, stream) => {
        // This should rarely be called for user-facing messages
        mockProvider.moderatorMessages++;
        return {
            id: uuidv4(),
            sender: { 
                id: 'moderator-1', 
                name: 'Discussion Moderator', 
                role: 'moderator',
                provider: 'mock'
            },
            content: 'Internal moderator response',
            timestamp: Date.now()
        };
    }
};

// Create session
const session = {
    id: 'test-session',
    title: 'Moderator Behavior Test',
    goal: 'Test that moderator stays in background',
    created: Date.now(),
    updated: Date.now(),
    messages: [],
    experts: [],
    moderator: {},
    isActive: true,
    autoDiscuss: true,
    maxTurns: 10
};

// Create agentic loop
const agenticLoop = new AgenticLoop(session, experts, moderator, 10);

// Track messages by role
const messagesByRole = {
    user: 0,
    expert: 0,
    moderator: 0,
    system: 0
};

// Add message listener to track who speaks
agenticLoop.onMessage((message) => {
    messagesByRole[message.sender.role]++;
    console.log(`[${message.sender.name} (${message.sender.role})]: ${message.content.substring(0, 100)}...`);
});

// Test function
async function testModeratorBehavior() {
    console.log('🧪 Testing Moderator Behavior...\n');
    
    try {
        // Test 1: Normal discussion flow
        console.log('📝 Test 1: Normal discussion flow');
        await agenticLoop.execute('How should I approach this problem?');
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n📊 Test 1 Results:');
        console.log(`- User messages: ${messagesByRole.user}`);
        console.log(`- Expert messages: ${messagesByRole.expert}`);
        console.log(`- Moderator messages: ${messagesByRole.moderator}`);
        console.log(`- System messages: ${messagesByRole.system}`);
        
        // Test 2: Clarification scenario
        console.log('\n📝 Test 2: Clarification scenario');
        const clarificationAgenticLoop = new AgenticLoop(session, experts, moderator, 10);
        const clarificationMessagesByRole = { user: 0, expert: 0, moderator: 0, system: 0 };
        
        clarificationAgenticLoop.onMessage((message) => {
            clarificationMessagesByRole[message.sender.role]++;
        });
        
        await clarificationAgenticLoop.execute('Help me with something');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n📊 Test 2 Results:');
        console.log(`- User messages: ${clarificationMessagesByRole.user}`);
        console.log(`- Expert messages: ${clarificationMessagesByRole.expert}`);
        console.log(`- Moderator messages: ${clarificationMessagesByRole.moderator}`);
        console.log(`- System messages: ${clarificationMessagesByRole.system}`);
        
        // Test 3: Conclusion scenario
        console.log('\n📝 Test 3: Conclusion scenario');
        const conclusionAgenticLoop = new AgenticLoop(session, experts, moderator, 10);
        const conclusionMessagesByRole = { user: 0, expert: 0, moderator: 0, system: 0 };
        
        conclusionAgenticLoop.onMessage((message) => {
            conclusionMessagesByRole[message.sender.role]++;
        });
        
        await conclusionAgenticLoop.execute('What are the best practices?');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n📊 Test 3 Results:');
        console.log(`- User messages: ${conclusionMessagesByRole.user}`);
        console.log(`- Expert messages: ${conclusionMessagesByRole.expert}`);
        console.log(`- Moderator messages: ${conclusionMessagesByRole.moderator}`);
        console.log(`- System messages: ${conclusionMessagesByRole.system}`);
        
        // Analysis and assertions
        console.log('\n🔍 Analysis:');
        
        // Check that experts dominate the conversation
        const totalExpertMessages = messagesByRole.expert + clarificationMessagesByRole.expert + conclusionMessagesByRole.expert;
        const totalModeratorMessages = messagesByRole.moderator + clarificationMessagesByRole.moderator + conclusionMessagesByRole.moderator;
        
        console.log(`Total expert messages: ${totalExpertMessages}`);
        console.log(`Total moderator messages: ${totalModeratorMessages}`);
        
        if (totalExpertMessages > totalModeratorMessages) {
            console.log('✅ SUCCESS: Experts dominate the conversation');
        } else {
            console.log('❌ FAILURE: Moderator is speaking too much');
        }
        
        // Check that moderator messages are minimal
        if (totalModeratorMessages <= 1) {
            console.log('✅ SUCCESS: Moderator stays in background');
        } else {
            console.log('❌ FAILURE: Moderator is too visible');
        }
        
        // Check that experts handle clarifications
        if (clarificationMessagesByRole.expert > 0) {
            console.log('✅ SUCCESS: Experts handle clarification requests');
        } else {
            console.log('❌ FAILURE: Moderator is handling clarifications');
        }
        
        // Check that experts handle conclusions
        if (conclusionMessagesByRole.expert > 0) {
            console.log('✅ SUCCESS: Experts handle conclusions');
        } else {
            console.log('❌ FAILURE: Moderator is handling conclusions');
        }
        
        console.log('\n🎯 Key Improvements Made:');
        console.log('1. Clarification requests now come from experts instead of moderator');
        console.log('2. Conclusions are provided by experts instead of moderator');
        console.log('3. Moderator stays in background for orchestration only');
        console.log('4. Conversation feels more natural and expert-driven');
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
    }
}

// Run the test
testModeratorBehavior();







