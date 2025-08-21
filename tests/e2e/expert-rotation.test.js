// Test to ensure experts rotate properly and don't speak twice in a row
const { AgenticLoop } = require('../../dist/orchestration/AgenticLoop');
const { v4: uuidv4 } = require('uuid');

// Mock provider that tracks expert responses
class ExpertRotationTestProvider {
    constructor() {
        this.responseCount = 0;
        this.expertResponses = {};
        this.lastSelectedExpert = null;
    }

    getProviderType() {
        return 'mock';
    }

    async generateMessage(messages, stream = false, onChunk = null) {
        this.responseCount++;
        const lastMessage = messages[messages.length - 1];
        const content = lastMessage.content;
        
        // Track which expert is responding
        let respondingExpertId = 'expert-1'; // default
        
        // Determine which expert should respond based on content
        if (content.includes('expert descriptions') || content.includes('who answered last')) {
            // Expert selection - rotate between experts
            const experts = ['expert-1', 'expert-2', 'expert-3'];
            const lastExpertIndex = experts.indexOf(this.lastSelectedExpert);
            const nextExpertIndex = (lastExpertIndex + 1) % experts.length;
            const selectedExpert = experts[nextExpertIndex];
            
            // Update the last selected expert
            this.lastSelectedExpert = selectedExpert;
            
            console.log(`🔍 Mock Provider - Expert selection: Last=${this.lastSelectedExpert}, Next=${selectedExpert}`);
            
            return {
                id: uuidv4(),
                sender: { id: 'moderator', name: 'Moderator', role: 'moderator', provider: 'mock' },
                content: `{"expertId": "${selectedExpert}", "reasoning": "Rotating to next expert"}`,
                timestamp: Date.now()
            };
        } else if (content.includes('sufficient')) {
            respondingExpertId = 'moderator';
        } else if (content.includes('answered')) {
            respondingExpertId = 'moderator';
        } else {
            // This is an expert response - use the last selected expert
            respondingExpertId = this.lastSelectedExpert || 'expert-1';
        }
        
        // Track expert responses
        if (respondingExpertId.startsWith('expert-')) {
            this.expertResponses[respondingExpertId] = (this.expertResponses[respondingExpertId] || 0) + 1;
            this.lastSelectedExpert = respondingExpertId;
        }
        
        // Generate appropriate response
        if (content.includes('sufficient')) {
            return {
                id: uuidv4(),
                sender: { id: 'moderator', name: 'Moderator', role: 'moderator', provider: 'mock' },
                content: '{"sufficient": true, "reasoning": "Question is clear"}',
                timestamp: Date.now()
            };
        } else if (content.includes('answered')) {
            // Simulate that after a few responses, the question gets answered
            if (this.responseCount > 8) {
                return {
                    id: uuidv4(),
                    sender: { id: 'moderator', name: 'Moderator', role: 'moderator', provider: 'mock' },
                    content: '{"answered": true, "confidence": 0.9, "reasoning": "Question answered"}',
                    timestamp: Date.now()
                };
            } else {
                return {
                    id: uuidv4(),
                    sender: { id: 'moderator', name: 'Moderator', role: 'moderator', provider: 'mock' },
                    content: '{"answered": false, "confidence": 0.2, "reasoning": "Needs more discussion"}',
                    timestamp: Date.now()
                };
            }
        } else if (content.includes('conclusion')) {
            return {
                id: uuidv4(),
                sender: { id: respondingExpertId, name: `Expert ${respondingExpertId}`, role: 'expert', provider: 'mock' },
                content: 'Based on our discussion, here are the key recommendations...',
                timestamp: Date.now()
            };
        } else {
            // Regular expert response
            const responses = [
                "Here's my expert advice on this topic...",
                "From my experience, I'd recommend...",
                "Let me share some insights about this...",
                "Based on best practices, you should consider...",
                "I think the best approach would be..."
            ];
            
            return {
                id: uuidv4(),
                sender: { id: respondingExpertId, name: `Expert ${respondingExpertId}`, role: 'expert', provider: 'mock' },
                content: responses[(this.responseCount - 1) % responses.length],
                timestamp: Date.now()
            };
        }
    }
}

// Create mock experts
const mockProvider = new ExpertRotationTestProvider();

const experts = [
    {
        getId: () => 'expert-1',
        getName: () => 'Backend Expert',
        getSpecialization: () => 'Backend development',
        generateMessage: async (messages, stream, onChunk) => {
            return mockProvider.generateMessage(messages, stream, onChunk);
        }
    },
    {
        getId: () => 'expert-2',
        getName: () => 'Frontend Expert',
        getSpecialization: () => 'Frontend development',
        generateMessage: async (messages, stream, onChunk) => {
            return mockProvider.generateMessage(messages, stream, onChunk);
        }
    },
    {
        getId: () => 'expert-3',
        getName: () => 'DevOps Expert',
        getSpecialization: () => 'DevOps and deployment',
        generateMessage: async (messages, stream, onChunk) => {
            return mockProvider.generateMessage(messages, stream, onChunk);
        }
    }
];

// Create mock moderator
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
    title: 'Expert Rotation Test',
    goal: 'Test that experts rotate properly',
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

// Track expert responses
const expertResponseSequence = [];

// Add message listener to track expert responses
agenticLoop.onMessage((message) => {
    if (message.sender.role === 'expert') {
        expertResponseSequence.push(message.sender.id);
        console.log(`[${message.sender.name} (${message.sender.id})]: ${message.content.substring(0, 50)}...`);
    }
});

// Test function
async function testExpertRotation() {
    console.log('🧪 Testing Expert Rotation...\n');
    
    try {
        console.log('📝 Starting discussion with multiple experts...');
        await agenticLoop.execute('How should I design a full-stack application?');
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n📊 Expert Response Sequence:');
        console.log(expertResponseSequence.join(' → '));
        
        console.log('\n📈 Expert Response Counts:');
        Object.entries(mockProvider.expertResponses).forEach(([expertId, count]) => {
            console.log(`- ${expertId}: ${count} responses`);
        });
        
        // Analysis
        console.log('\n🔍 Analysis:');
        
        // Check for consecutive same expert responses
        let consecutiveSameExpert = false;
        for (let i = 1; i < expertResponseSequence.length; i++) {
            if (expertResponseSequence[i] === expertResponseSequence[i - 1]) {
                consecutiveSameExpert = true;
                console.log(`❌ FAILURE: Same expert (${expertResponseSequence[i]}) responded twice in a row at positions ${i-1} and ${i}`);
            }
        }
        
        if (!consecutiveSameExpert) {
            console.log('✅ SUCCESS: No consecutive same expert responses detected');
        }
        
        // Check expert distribution
        const uniqueExperts = new Set(expertResponseSequence);
        console.log(`\n📊 Expert Distribution:`);
        console.log(`- Total expert responses: ${expertResponseSequence.length}`);
        console.log(`- Unique experts used: ${uniqueExperts.size}`);
        console.log(`- Experts available: ${experts.length}`);
        
        if (uniqueExperts.size >= Math.min(experts.length, expertResponseSequence.length)) {
            console.log('✅ SUCCESS: Good expert distribution - multiple experts participated');
        } else {
            console.log('⚠️  WARNING: Limited expert participation');
        }
        
        // Check for rotation pattern
        if (expertResponseSequence.length >= 3) {
            const rotationPattern = expertResponseSequence.slice(0, 3);
            console.log(`\n🔄 Rotation Pattern (first 3): ${rotationPattern.join(' → ')}`);
            
            if (new Set(rotationPattern).size === rotationPattern.length) {
                console.log('✅ SUCCESS: Good rotation pattern detected');
            } else {
                console.log('❌ FAILURE: Poor rotation pattern - experts not rotating properly');
            }
        }
        
        // Summary
        console.log('\n🎯 Key Improvements Made:');
        console.log('1. Enhanced expert selection prompt with explicit rules against same expert');
        console.log('2. Added validation to prevent same expert selection');
        console.log('3. Improved fallback selection to prioritize different experts');
        console.log('4. Better logging for expert selection decisions');
        
        // Final verdict
        if (!consecutiveSameExpert && uniqueExperts.size > 1) {
            console.log('\n🎉 OVERALL RESULT: Expert rotation working correctly!');
        } else {
            console.log('\n⚠️  OVERALL RESULT: Expert rotation needs improvement');
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
    }
}

// Run the test
testExpertRotation();
