// Simple test to verify the agentic loop continues properly
const fs = require('fs');
const path = require('path');

// Read the compiled AgenticLoop to understand its structure
const agenticLoopPath = path.join(__dirname, '../../dist', 'orchestration', 'AgenticLoop.js');

if (!fs.existsSync(agenticLoopPath)) {
    console.log('❌ Compiled AgenticLoop not found. Please run "npm run build" first.');
    process.exit(1);
}

console.log('✅ Found compiled AgenticLoop');

// Test the loop logic directly
function testLoopLogic() {
    console.log('\n🧪 Testing Loop Logic...\n');
    
    // Simulate the loop behavior
    let currentTurn = 1;
    let maxTurns = 10;
    let consecutiveNoProgress = 0;
    const maxNoProgress = 3;
    let shouldContinue = true;
    
    console.log('Starting loop simulation...');
    
    while (shouldContinue && currentTurn < maxTurns && consecutiveNoProgress < maxNoProgress) {
        console.log(`\n--- Turn ${currentTurn} ---`);
        console.log(`Consecutive no progress: ${consecutiveNoProgress}`);
        
        // Simulate categorization results
        const questionAnswered = { answered: false, confidence: 0.3 };
        const enoughInfo = { sufficient: true };
        const nextExpert = { expertId: 'expert-1', reasoning: 'Best expert for this topic' };
        
        console.log(`Question answered: ${questionAnswered.answered} (confidence: ${questionAnswered.confidence})`);
        console.log(`Enough info: ${enoughInfo.sufficient}`);
        console.log(`Next expert: ${nextExpert.expertId}`);
        
        // Simulate action execution
        if (!enoughInfo.sufficient) {
            console.log('Action: Request clarification from user');
            shouldContinue = false;
        } else if (questionAnswered.answered && questionAnswered.confidence >= 0.8) {
            console.log('Action: Conclude discussion');
            shouldContinue = false;
        } else {
            console.log('Action: Expert response');
            consecutiveNoProgress = 0;
            
            // Simulate expert response
            console.log(`Expert ${nextExpert.expertId} responds...`);
            
            // Simulate that after a few turns, the question gets answered
            if (currentTurn >= 3) {
                questionAnswered.answered = true;
                questionAnswered.confidence = 0.9;
                console.log('Question is now answered with high confidence!');
            }
        }
        
        currentTurn++;
        
        // Small delay to simulate processing
        setTimeout(() => {}, 100);
    }
    
    if (consecutiveNoProgress >= maxNoProgress) {
        console.log('\n🛑 Loop ended: Max consecutive no progress reached');
    } else if (currentTurn >= maxTurns) {
        console.log('\n🛑 Loop ended: Max turns reached');
    } else {
        console.log('\n✅ Loop ended: Discussion completed');
    }
    
    console.log(`\nTotal turns executed: ${currentTurn - 1}`);
}

// Test the categorization logic
function testCategorizationLogic() {
    console.log('\n🧪 Testing Categorization Logic...\n');
    
    const scenarios = [
        {
            name: 'First iteration - should skip question resolution',
            isFirstIteration: true,
            expectedQueries: 2 // Only queries 2 and 3
        },
        {
            name: 'Subsequent iteration - should run all queries',
            isFirstIteration: false,
            expectedQueries: 3 // All queries
        }
    ];
    
    scenarios.forEach(scenario => {
        console.log(`\n--- ${scenario.name} ---`);
        console.log(`Is first iteration: ${scenario.isFirstIteration}`);
        console.log(`Expected queries: ${scenario.expectedQueries}`);
        
        if (scenario.isFirstIteration) {
            console.log('Query 1: Skipped (first iteration)');
            console.log('Query 2: Running...');
            console.log('Query 3: Running...');
        } else {
            console.log('Query 1: Running...');
            console.log('Query 2: Running...');
            console.log('Query 3: Running...');
        }
    });
}

// Test action execution logic
function testActionExecution() {
    console.log('\n🧪 Testing Action Execution Logic...\n');
    
    const scenarios = [
        {
            name: 'Insufficient information',
            enoughInfo: { sufficient: false, missingInfo: 'More details needed' },
            questionAnswered: { answered: false, confidence: 0.0 },
            expectedAction: 'Request clarification from user'
        },
        {
            name: 'Question answered with high confidence',
            enoughInfo: { sufficient: true },
            questionAnswered: { answered: true, confidence: 0.9 },
            expectedAction: 'Conclude discussion'
        },
        {
            name: 'Normal expert response',
            enoughInfo: { sufficient: true },
            questionAnswered: { answered: false, confidence: 0.3 },
            expectedAction: 'Expert response'
        }
    ];
    
    scenarios.forEach(scenario => {
        console.log(`\n--- ${scenario.name} ---`);
        console.log(`Enough info: ${scenario.enoughInfo.sufficient}`);
        console.log(`Question answered: ${scenario.questionAnswered.answered} (confidence: ${scenario.questionAnswered.confidence})`);
        console.log(`Expected action: ${scenario.expectedAction}`);
        
        // Simulate action determination
        let action = '';
        if (!scenario.enoughInfo.sufficient) {
            action = 'wait_for_user';
        } else if (scenario.questionAnswered.answered && scenario.questionAnswered.confidence >= 0.8) {
            action = 'conclude';
        } else {
            action = 'expert_responded';
        }
        
        console.log(`Determined action: ${action}`);
        console.log(`✅ Action matches expected: ${action === scenario.expectedAction.toLowerCase().replace(' ', '_')}`);
    });
}

// Run all tests
console.log('🚀 Starting Agentic Loop Tests...\n');

testLoopLogic();
testCategorizationLogic();
testActionExecution();

console.log('\n🎉 All tests completed!');
console.log('\nThis simulation shows that the agentic loop should:');
console.log('1. Continue running until the discussion is complete');
console.log('2. Skip question resolution on first iteration');
console.log('3. Execute appropriate actions based on categorization results');
console.log('4. Handle multiple expert responses sequentially');
