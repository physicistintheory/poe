# Agentic Loop Design for Moderated Expert Panel

## Overview
This document outlines the agentic loop design for a moderated panel of expert agents. The loop orchestrates a structured discussion where experts contribute insights while a moderator guides the conversation toward the session goal. **The user remains actively involved throughout the process, and the moderator only intervenes when follow-up questions are needed.**

## Core Loop Structure

### 1. Loop Initialization
- Validate session state and prerequisites
- Check if maximum turns reached
- Set processing status
- Increment turn counter
- Log loop start
- **User Input Check**: Verify if user has provided input to respond to

### 2. Expert Response Phase
For each expert agent in the panel:
- **Context Preparation**: Provide conversation history, current discussion state, and user's latest input
- **Response Generation**: Generate expert response with streaming support
- **Response Validation**: Ensure response meets quality and relevance criteria
- **Message Integration**: Add response to conversation history
- **Listener Notification**: Notify UI of new message

### 3. Discussion Analysis Phase
- **Expert Interaction Assessment**: Analyze how experts are responding to each other
- **Topic Convergence Check**: Evaluate if discussion is moving toward the goal
- **Conflict Detection**: Identify disagreements or conflicting viewpoints
- **Engagement Monitoring**: Track participation levels and response quality
- **Question Resolution Check**: Assess if the user's question has been adequately addressed

### 4. Moderator Decision Phase
- **Question Resolution Assessment**: Determine if the user's question has been fully answered
- **Follow-up Question Detection**: Identify if additional information from the user is needed
- **Intervention Types** (only when follow-up questions are needed):
  - **Clarification Request**: Ask user to clarify ambiguous aspects of their question
  - **Additional Context Request**: Request more specific details from the user
  - **Question Refinement**: Suggest a more focused version of the user's question
  - **Scope Expansion**: Ask if user wants to explore related aspects
  - **Conclusion Confirmation**: Ask user if their question has been satisfactorily answered

### 5. Moderator Action Phase (only if follow-up question needed)
- **Response Generation**: Generate appropriate follow-up question for the user
- **Response Integration**: Add moderator message to conversation
- **Listener Notification**: Notify UI of moderator intervention
- **Status Update**: Set status to WAITING_USER for user response

### 6. Loop Continuation Decision
- **Question Resolution Check**: Assess if user's question has been fully addressed
- **User Satisfaction Check**: Determine if user needs additional information
- **Auto-Discuss Evaluation**: Check if auto-discuss mode is enabled and question is still open
- **Turn Limit Check**: Verify we haven't exceeded maximum turns
- **Quality Assessment**: Evaluate if discussion quality is maintained

### 7. Loop Termination Conditions
- **Question Fully Addressed**: User's question has been comprehensively answered
- **User Requests Stop**: User indicates they have received sufficient information
- **Max Turns Reached**: Maximum number of discussion rounds reached
- **Quality Degradation**: Discussion quality has significantly declined
- **Error State**: Critical error in the conversation flow

## Key Design Principles

### 1. User-Centric Flow
- **User Input Drives Discussion**: Each loop iteration responds to user input
- **Question Resolution Focus**: Primary goal is to fully address the user's question
- **User Satisfaction Priority**: Loop continues until user's needs are met
- **User Control**: User can interrupt, redirect, or conclude the discussion

### 2. Expert Panel Autonomy
- **Natural Expert Interaction**: Experts can respond to each other without moderator interference
- **Self-Organizing Discussion**: Panel naturally explores the question space
- **No Artificial Constraints**: Experts maintain authentic perspectives and interaction patterns
- **Emergent Consensus**: Allow natural convergence on answers through expert dialogue

### 3. Minimal Moderator Intervention
- **Follow-up Questions Only**: Moderator only intervenes when user input is needed
- **No Topic Steering**: Let experts naturally guide the discussion
- **No Conflict Resolution**: Allow experts to resolve disagreements themselves
- **No Synthesis**: Let the conversation flow naturally without artificial summaries

### 4. Question Resolution Focus
- **Comprehensive Answering**: Ensure all aspects of user's question are addressed
- **Depth and Breadth**: Allow sufficient exploration of the topic
- **User Confirmation**: Check with user if their question has been answered
- **Flexible Scope**: Adapt discussion scope based on user's needs

### 5. Quality Maintenance
- **Relevance Monitoring**: Ensure discussion stays focused on user's question
- **Engagement Tracking**: Monitor expert participation and response quality
- **Natural Termination**: End when question is resolved, not artificially

## State Management

### Loop State Variables
- `currentTurn`: Current discussion round number
- `questionResolution`: Assessment of how well user's question has been addressed
- `expertEngagement`: Tracking of expert participation and quality
- `userSatisfaction`: User's indication of whether their question is answered
- `discussionQuality`: Overall quality score of the discussion
- `pendingUserInput`: Whether we're waiting for user response to follow-up question

### Status Transitions
- `IDLE` → `PROCESSING`: Loop initialization (user input received)
- `PROCESSING` → `WAITING_USER`: Follow-up question asked or user intervention needed
- `WAITING_USER` → `PROCESSING`: User provides input or clarification
- `PROCESSING` → `IDLE`: Question resolved, discussion complete
- `PROCESSING` → `ERROR`: Error condition

## Data Flow

### Inputs to startNextRound()
- `userMessage`: Latest user input/question to respond to
- `session.messages`: Complete conversation history
- `session.autoDiscuss`: Whether to continue automatically
- `currentTurn`: Current iteration count
- `maxTurns`: Maximum allowed iterations

### Outputs from startNextRound()
- Updated `session.messages`: New expert and moderator responses added
- Updated `currentTurn`: Incremented turn counter
- Status changes: `PROCESSING` → `WAITING_USER` or `IDLE`
- UI notifications: New messages and status updates

## Error Handling

### Phase-Specific Error Recovery
- **Expert Response Errors**: Skip problematic expert, continue with others
- **Moderator Errors**: Fall back to basic follow-up question strategies
- **Network Errors**: Retry with exponential backoff
- **Critical Errors**: Terminate loop and set error status

### Graceful Degradation
- Continue discussion with available experts if some fail
- Use simplified follow-up questions if advanced moderation fails
- Preserve conversation state for recovery

## Performance Considerations

### Rate Limiting
- Implement delays between expert responses to avoid API limits
- Batch notifications to reduce UI updates
- Optimize context preparation to minimize token usage

### Memory Management
- Limit conversation history length for long discussions
- Implement message summarization for very long sessions
- Clean up temporary state between rounds

## Monitoring and Logging

### Loop Metrics
- Turn duration and completion time
- Expert response quality scores
- Question resolution progress tracking
- User satisfaction levels
- Error rates and recovery success

### Debug Information
- Detailed phase execution logs
- Expert response generation details
- Moderator decision rationale
- State transition tracking
- User input processing details

## Future Enhancements

### Advanced User Interaction
- Multi-turn user questioning
- User preference learning
- Interactive clarification requests
- Real-time user feedback integration

### Question Resolution
- Multi-dimensional question tracking
- Sub-question identification and management
- Answer completeness assessment
- User satisfaction prediction

### Expert Interaction
- Direct expert-to-expert questioning
- Collaborative problem-solving modes
- Specialized discussion formats (debate, brainstorming, etc.)
- Expert specialization matching to question types
