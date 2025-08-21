// Simple debug test
console.log('Starting simple debug test...');

try {
    const { AgenticLoop } = require('../../dist/orchestration/AgenticLoop');
    console.log('✅ AgenticLoop imported successfully');
    
    // Create a minimal test
    const mockSession = {
        id: 'test',
        messages: [],
        experts: [],
        moderator: {},
        isActive: true,
        autoDiscuss: true,
        maxTurns: 10
    };
    
    const mockExperts = [
        {
            getId: () => 'expert-1',
            getName: () => 'Test Expert 1',
            getSpecialization: () => 'Test specialization 1'
        },
        {
            getId: () => 'expert-2',
            getName: () => 'Test Expert 2',
            getSpecialization: () => 'Test specialization 2'
        }
    ];
    const mockModerator = {
        getId: () => 'mod-1',
        getName: () => 'Test Moderator',
        getProviderType: () => 'mock'
    };
    
    console.log('Creating AgenticLoop instance...');
    const agenticLoop = new AgenticLoop(mockSession, mockExperts, mockModerator, 10);
    console.log('✅ AgenticLoop instance created');
    
    console.log('Calling execute method...');
    agenticLoop.execute('Test message');
    console.log('✅ Execute method called');
    
} catch (error) {
    console.error('❌ Error:', error);
}
