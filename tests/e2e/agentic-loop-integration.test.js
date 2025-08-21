// Integration test for AgenticLoop
const { AgenticLoop } = require('../../dist/orchestration/AgenticLoop');
const { ExpertAgent } = require('../../dist/agents/ExpertAgent');
const { ModeratorAgent } = require('../../dist/agents/ModeratorAgent');
const { v4: uuidv4 } = require('uuid');

// Mock provider that simulates AI responses
class MockAIProvider {
    constructor() {
        this.name = 'mock';
        this.responseCount = 0;
    }

    getProviderType() {
        return 'mock';
    }

    async generateMessage(messages, stream = false, onChunk = null) {
        this.responseCount++;
        const lastMessage = messages[messages.length - 1];
        const content = lastMessage.content;
        
        console.log(`\n🔍 Mock Provider - Response #${this.responseCount}, Content: "${content.substring(0, 100)}..."`);
        
        // Simulate different types of responses based on content
        let response = '';
        
        if (content.includes('sufficient')) {
            response = '{"sufficient": true, "reasoning": "Question is clear enough"}';
        } else if (content.includes('answered')) {
            // Simulate that after a few responses, the question gets answered
            if (this.responseCount > 5) {
                response = '{"answered": true, "confidence": 0.9, "reasoning": "Question has been adequately addressed"}';
            } else {
                response = '{"answered": false, "confidence": 0.2, "reasoning": "Question needs more discussion"}';
            }
        } else if (content.includes('expertId')) {
            // Rotate between experts
            const experts = ['expert-1', 'expert-2', 'expert-3'];
            const selectedExpert = experts[(this.responseCount - 1) % experts.length];
            response = `{"expertId": "${selectedExpert}", "reasoning": "Best expert for this topic"}`;
        } else {
            // Regular expert response
            const expertResponses = [
                "As a backend engineer, I recommend using Node.js with Express for your API. Consider implementing proper authentication and database optimization.",
                "For frontend development, I suggest using React with TypeScript. Focus on component reusability and responsive design principles.",
                "To optimize performance, consider implementing caching strategies, code splitting, and database query optimization.",
                "For security, implement proper input validation, use HTTPS, and follow OWASP guidelines.",
                "For scalability, consider using microservices architecture and implementing proper load balancing."
            ];
            response = expertResponses[(this.responseCount - 1) % expertResponses.length];
        }
        
        return {
            id: uuidv4(),
            sender: { 
                id: 'mock-expert', 
                name: 'Mock Expert', 
                role: 'expert',
                provider: 'mock'
            },
            content: response,
            timestamp: Date.now()
        };
    }
}

// Create mock provider
const mockProvider = new MockAIProvider();

// Create mock experts with proper methods
const experts = [
    {
        getId: () => 'expert-1',
        getName: () => 'Backend Engineer',
        getSpecialization: () => 'Backend development, APIs, databases',
        generateMessage: async (messages, stream, onChunk) => {
            return mockProvider.generateMessage(messages, stream, onChunk);
        }
    },
    {
        getId: () => 'expert-2',
        getName: () => 'Frontend Developer',
        getSpecialization: () => 'Frontend development, UI/UX, React',
        generateMessage: async (messages, stream, onChunk) => {
            return mockProvider.generateMessage(messages, stream, onChunk);
        }
    },
    {
        getId: () => 'expert-3',
        getName: () => 'Performance Optimizer',
        getSpecialization: () => 'Performance optimization, caching, efficiency',
        generateMessage: async (messages, stream, onChunk) => {
            return mockProvider.generateMessage(messages, stream, onChunk);
        }
    }
];

// Create mock moderator with proper methods
const moderator = {
    getId: () => 'moderator-1',
    getName: () => 'Discussion Moderator',
    getProviderType: () => 'mock',
    generateMessage: async (messages, stream) => {
        return mockProvider.generateMessage(messages, stream);
    }
};

// Create session
const session = {
    id: 'test-session',
    title: 'Test Discussion',
    goal: 'Test the agentic loop functionality',
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

console.log(`Initial status: ${agenticLoop.getStatus()}`);

// Track messages and status
const messages = [];
const statusChanges = [];

// Add message listener
agenticLoop.onMessage((message) => {
    messages.push(message);
    console.log(`\n[${message.sender.name}]: ${message.content}`);
});

// Add status listener
agenticLoop.onStatusChange((status) => {
    statusChanges.push(status);
    console.log(`\n🔄 Status: ${status}`);
});

// Test function
async function testAgenticLoop() {
    console.log('🧪 Testing Agentic Loop Integration...\n');
    
    try {
        console.log('📝 Starting discussion with: "How should I design my backend API?"');
        
        // Start the agentic loop
        await agenticLoop.execute('How should I design my backend API?');
        
        // Wait a bit for all processing to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n📊 Test Results:');
        console.log(`Total messages: ${messages.length}`);
        console.log(`Status changes: ${statusChanges.join(' → ')}`);
        
        // Analyze results
        const userMessages = messages.filter(m => m.sender.role === 'user');
        const expertMessages = messages.filter(m => m.sender.role === 'expert');
        const moderatorMessages = messages.filter(m => m.sender.role === 'moderator');
        
        console.log(`\n📈 Breakdown:`);
        console.log(`- User messages: ${userMessages.length}`);
        console.log(`- Expert messages: ${expertMessages.length}`);
        console.log(`- Moderator messages: ${moderatorMessages.length}`);
        
        // Check if the loop continued beyond the first response
        if (expertMessages.length > 1) {
            console.log('\n✅ SUCCESS: Multiple expert responses detected!');
            console.log('The agentic loop is working correctly and continuing the discussion.');
        } else if (expertMessages.length === 1) {
            console.log('\n⚠️  WARNING: Only one expert response detected.');
            console.log('This might indicate the loop is still stopping after the first response.');
        } else {
            console.log('\n❌ ERROR: No expert responses detected.');
        }
        
        // Show final status
        const finalStatus = statusChanges[statusChanges.length - 1];
        console.log(`\n🏁 Final status: ${finalStatus}`);
        
        if (finalStatus === 'waiting_user') {
            console.log('✅ Discussion completed and waiting for user input.');
        } else if (finalStatus === 'idle') {
            console.log('✅ Discussion completed and system is idle.');
        } else {
            console.log(`⚠️  Unexpected final status: ${finalStatus}`);
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
    }
}

// Run the test
testAgenticLoop();
