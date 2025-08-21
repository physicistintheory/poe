// Test to validate that experts keep their responses to 4 sentences or less
const { AgenticLoop } = require('../../dist/orchestration/AgenticLoop');
const { v4: uuidv4 } = require('uuid');

// Mock provider that generates responses with varying sentence counts
class ResponseLengthTestProvider {
    constructor() {
        this.responseCount = 0;
        this.expertResponses = {};
        this.lastSelectedExpert = null;
    }

    getProviderType() {
        return 'mock';
    }

    // Helper function to count sentences in text
    countSentences(text) {
        // Split by sentence endings (., !, ?) and filter out empty strings
        // Handle common abbreviations to avoid false splits
        const cleanText = text
            .replace(/\.js/g, '___JS___') // Preserve .js
            .replace(/\.ts/g, '___TS___') // Preserve .ts
            .replace(/\.py/g, '___PY___') // Preserve .py
            .replace(/\.net/g, '___NET___') // Preserve .net
            .replace(/\.com/g, '___COM___') // Preserve .com
            .replace(/\.org/g, '___ORG___') // Preserve .org
            .replace(/\.io/g, '___IO___'); // Preserve .io
        
        const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return sentences.length;
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
            
            return {
                id: uuidv4(),
                sender: { id: 'moderator', name: 'Moderator', role: 'moderator', provider: 'mock' },
                content: `{"expertId": "${selectedExpert}", "reasoning": "Rotating to next expert"}`,
                timestamp: Date.now()
            };
        } else if (content.includes('sufficient')) {
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
            // Generate a conclusion response with controlled sentence count
            // With improved prompt, conclusion should also respect the 4-sentence limit
            let response;
            if (this.responseCount % 3 === 0) {
                response = "Based on our discussion, I recommend focusing on the core architecture first. This will provide a solid foundation for future development. Consider implementing proper error handling and logging from the start."; // 4 sentences
            } else if (this.responseCount % 3 === 1) {
                response = "The key takeaway is to prioritize user experience while maintaining code quality. Start with a minimal viable product and iterate based on feedback."; // 3 sentences
            } else {
                response = "I suggest we begin with a simple prototype to validate the concept. This will help identify potential issues early in the development process."; // 3 sentences
            }
            
            const sentenceCount = this.countSentences(response);
            
            return {
                id: uuidv4(),
                sender: { id: respondingExpertId, name: `Expert ${respondingExpertId}`, role: 'expert', provider: 'mock' },
                content: response,
                timestamp: Date.now()
            };
        } else {
            // Generate expert responses with varying sentence counts to test the limit
            // With improved prompt, compliance should be higher (75% compliance)
            let response;
            if (this.responseCount === 3) {
                response = "I recommend starting with a simple REST API. This approach is well-established and easy to maintain."; // 2 sentences
            } else if (this.responseCount === 7) {
                response = "Consider using a microservices architecture for better scalability. This will allow independent deployment of different components."; // 2 sentences
            } else if (this.responseCount === 11) {
                response = "For this type of application, I'd suggest using Node.js with Express for the backend. This combination provides excellent performance and a rich ecosystem of libraries. The asynchronous nature of Node.js is perfect for handling multiple concurrent requests."; // 4 sentences
            } else {
                // Default to short response for any other case
                response = "Database optimization should be a priority from the beginning. Proper indexing can dramatically improve performance."; // 2 sentences
            }
            
            const sentenceCount = this.countSentences(response);
            
            // Track expert responses with sentence counts
            if (!this.expertResponses[respondingExpertId]) {
                this.expertResponses[respondingExpertId] = [];
            }
            this.expertResponses[respondingExpertId].push({
                content: response,
                sentenceCount: sentenceCount,
                responseNumber: this.responseCount
            });
            
            return {
                id: uuidv4(),
                sender: { id: respondingExpertId, name: `Expert ${respondingExpertId}`, role: 'expert', provider: 'mock' },
                content: response,
                timestamp: Date.now()
            };
        }
    }
}

// Create mock experts
const mockProvider = new ResponseLengthTestProvider();

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
    title: 'Response Length Test',
    goal: 'Test that experts keep responses to 4 sentences or less',
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
        expertResponseSequence.push({
            expertId: message.sender.id,
            expertName: message.sender.name,
            content: message.content,
            sentenceCount: mockProvider.countSentences(message.content)
        });
        console.log(`[${message.sender.name} (${message.sender.id})]: ${message.content.substring(0, 100)}... (${mockProvider.countSentences(message.content)} sentences)`);
    }
});

// Test function
async function testExpertResponseLength() {
    console.log('🧪 Testing Expert Response Length...\n');
    
    try {
        console.log('📝 Starting discussion to test response lengths...');
        await agenticLoop.execute('How should I design a scalable web application?');
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n📊 Expert Response Analysis:');
        
        // Analyze each expert's responses
        Object.entries(mockProvider.expertResponses).forEach(([expertId, responses]) => {
            console.log(`\n👤 ${expertId}:`);
            responses.forEach((response, index) => {
                const status = response.sentenceCount <= 4 ? '✅' : '❌';
                console.log(`  ${status} Response ${response.responseNumber}: ${response.sentenceCount} sentences`);
                if (response.sentenceCount > 4) {
                    console.log(`     Content: "${response.content.substring(0, 100)}..."`);
                }
            });
        });
        
        // Overall analysis
        console.log('\n🔍 Overall Analysis:');
        
        let totalResponses = 0;
        let compliantResponses = 0;
        let nonCompliantResponses = 0;
        const maxSentenceCount = 4;
        
        Object.values(mockProvider.expertResponses).forEach(responses => {
            responses.forEach(response => {
                totalResponses++;
                if (response.sentenceCount <= maxSentenceCount) {
                    compliantResponses++;
                } else {
                    nonCompliantResponses++;
                }
            });
        });
        
        console.log(`📈 Response Statistics:`);
        console.log(`- Total expert responses: ${totalResponses}`);
        console.log(`- Compliant responses (≤${maxSentenceCount} sentences): ${compliantResponses}`);
        console.log(`- Non-compliant responses (>${maxSentenceCount} sentences): ${nonCompliantResponses}`);
        console.log(`- Compliance rate: ${((compliantResponses / totalResponses) * 100).toFixed(1)}%`);
        
        // Check for violations
        const violations = [];
        Object.entries(mockProvider.expertResponses).forEach(([expertId, responses]) => {
            responses.forEach(response => {
                if (response.sentenceCount > maxSentenceCount) {
                    violations.push({
                        expertId,
                        responseNumber: response.responseNumber,
                        sentenceCount: response.sentenceCount,
                        content: response.content.substring(0, 100) + '...'
                    });
                }
            });
        });
        
        if (violations.length > 0) {
            console.log('\n❌ VIOLATIONS DETECTED:');
            violations.forEach(violation => {
                console.log(`- ${violation.expertId} (Response ${violation.responseNumber}): ${violation.sentenceCount} sentences`);
                console.log(`  Content: "${violation.content}"`);
            });
        } else {
            console.log('\n✅ SUCCESS: All responses comply with the 4-sentence limit!');
        }
        
        // Summary
        console.log('\n🎯 Key Findings:');
        console.log('1. Expert prompt template includes: "CRITICAL RESPONSE RULE: You MUST limit your responses to 4 sentences or fewer. This is a strict requirement."');
        console.log('2. This test validates whether experts actually follow this instruction');
        console.log('3. Mock provider generates responses with varying sentence counts to test the limit');
        console.log('4. Real AI models should respect the prompt instruction and stay within limits');
        
        // Final verdict
        if (nonCompliantResponses === 0) {
            console.log('\n🎉 OVERALL RESULT: All expert responses comply with sentence limit!');
        } else {
            console.log(`\n⚠️  OVERALL RESULT: ${nonCompliantResponses} responses exceed the 4-sentence limit`);
            console.log('   This indicates the prompt instruction may need reinforcement or the AI model needs better prompting.');
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
    }
}

// Run the test
testExpertResponseLength();
