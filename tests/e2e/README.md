# End-to-End Tests for Agentic Loop

This directory contains end-to-end tests for the Agentic Loop functionality that can be run independently of the VS Code environment.

## Test Files

### `agentic-loop-integration.test.js`
**Full integration test with mock AI provider**

This is the most comprehensive test that simulates the entire agentic loop with mock AI responses. It:
- Creates mock experts and moderator with realistic behavior
- Simulates AI responses for categorization queries
- Tests the complete discussion flow from start to finish
- Verifies that multiple experts respond sequentially
- Checks proper status transitions and loop termination

**Run with:**
```bash
node tests/e2e/agentic-loop-integration.test.js
```

**Expected output:** Multiple expert responses and proper discussion conclusion

### `agentic-loop-logic.test.js`
**Logic simulation test**

This test simulates the core loop logic without requiring actual AI providers. It:
- Tests categorization logic scenarios
- Verifies action execution paths
- Simulates different discussion outcomes
- Tests loop termination conditions

**Run with:**
```bash
node tests/e2e/agentic-loop-logic.test.js
```

**Expected output:** Detailed simulation of loop behavior and decision points

### `agentic-loop-debug.test.js`
**Minimal debug test**

A simple test to verify basic functionality and debug issues. It:
- Tests basic AgenticLoop instantiation
- Verifies method calls work correctly
- Helps isolate specific issues

**Run with:**
```bash
node tests/e2e/agentic-loop-debug.test.js
```

**Expected output:** Basic execution verification

### `moderator-behavior.test.js`
**Moderator behavior test**

Tests that the moderator stays in the background and doesn't dominate conversations. It:
- Verifies experts handle clarification requests instead of moderator
- Ensures conclusions come from experts rather than moderator
- Tracks message distribution by role
- Validates that moderator stays in background for orchestration only

**Run with:**
```bash
node tests/e2e/moderator-behavior.test.js
```

**Expected output:** Confirmation that experts dominate conversations and moderator stays in background

### `expert-rotation.test.js`
**Expert rotation test**

Tests that experts rotate properly and don't speak twice in a row. It:
- Verifies no consecutive same expert responses
- Ensures multiple experts participate in discussions
- Tracks expert response sequences and distribution
- Validates proper rotation patterns

**Run with:**
```bash
node tests/e2e/expert-rotation.test.js
```

**Expected output:** Confirmation that experts rotate properly with no consecutive same expert responses

### `expert-response-length.test.js`
**Expert response length test**

Tests that experts keep their responses to 3 sentences or less as specified in their prompt template. It:
- Validates compliance with the 3-sentence limit instruction
- Tracks sentence counts for each expert response
- Identifies violations of the length constraint
- Provides compliance rate statistics
- Helps verify that prompt instructions are being followed

**Run with:**
```bash
node tests/e2e/expert-response-length.test.js
```

**Expected output:** Analysis of response lengths with compliance rate and any violations detected

## Running All E2E Tests

You can run all e2e tests with:

```bash
# Run all tests
for test in tests/e2e/*.test.js; do echo "Running $test..."; node "$test"; echo ""; done

# Or run them individually
node tests/e2e/agentic-loop-integration.test.js
node tests/e2e/agentic-loop-logic.test.js
node tests/e2e/agentic-loop-debug.test.js
node tests/e2e/moderator-behavior.test.js
node tests/e2e/expert-rotation.test.js
node tests/e2e/expert-response-length.test.js
```

## Test Prerequisites

Make sure to build the project first:

```bash
npm run build
```

## What These Tests Verify

✅ **Continuous Discussion Flow**: The agentic loop continues beyond the first expert response  
✅ **Multiple Expert Responses**: Different experts can respond sequentially  
✅ **Proper Categorization**: The 3-query categorization system works correctly  
✅ **Loop Termination**: Discussions conclude when questions are answered or limits are reached  
✅ **Status Management**: Proper status transitions throughout the discussion  
✅ **Error Handling**: Graceful handling of edge cases and errors  
✅ **Expert-Driven Conversations**: Experts handle clarifications and conclusions, moderator stays in background  
✅ **Expert Rotation**: Experts rotate properly with no consecutive same expert responses  
✅ **Response Length Compliance**: Experts respect the 4-sentence limit instruction  

## Troubleshooting

If tests fail:

1. **Build the project**: `npm run build`
2. **Check imports**: Ensure dist/ directory exists with compiled files
3. **Verify paths**: Make sure test files can find the compiled modules
4. **Check logs**: Look for specific error messages in test output

## Adding New E2E Tests

When adding new e2e tests:

1. Follow the naming convention: `*.test.js`
2. Add documentation to this README
3. Include proper error handling and logging
4. Test both success and failure scenarios


