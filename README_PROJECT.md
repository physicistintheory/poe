# Panel of Experts (POE) - Cursor Plugin

A Cursor IDE plugin that creates a real-time panel discussion between multiple LLMs from different providers, allowing them to collaborate, debate, and solve problems together.

## Features

- **Multi-LLM Collaboration**: Integrates models from OpenAI, Anthropic, and Google to work together in one conversation
- **Expert Personas**: Assign specialized roles to each LLM (e.g., Backend Engineer, Creative Brainstormer, Code Optimizer)
- **Moderator Agent**: An AI facilitator that keeps the discussion on track and ensures productive outcomes
- **Auto-Discussion Mode**: Let the AIs debate and build on each other's ideas automatically
- **Real-time Streaming**: See expert responses as they're generated
- **Multi-provider Support**: Use a mix of GPT-4, Claude, Gemini and other models in the same discussion

Perfect for brainstorming, technical evaluations, debugging, exploring different perspectives, and more!

## Project Structure

```
poe/
├── dist/                    # Compiled output
├── src/
│   ├── agents/              # Agent implementation
│   │   ├── BaseAgent.ts     # Abstract agent class
│   │   ├── ExpertAgent.ts   # Expert agent implementation
│   │   └── ModeratorAgent.ts # Moderator agent implementation
│   ├── providers/           # LLM provider implementations
│   │   ├── BaseProvider.ts  # Abstract provider class
│   │   ├── OpenAIProvider.ts # OpenAI implementation
│   │   ├── AnthropicProvider.ts # Anthropic implementation
│   │   ├── GoogleProvider.ts # Google AI implementation
│   │   └── ProviderManager.ts # Manages provider instances
│   ├── orchestration/       # Conversation orchestration
│   │   └── ConversationOrchestrator.ts # Controls the multi-LLM conversation flow
│   ├── types/               # Type definitions
│   │   └── index.ts         # Common types and interfaces
│   ├── utils/               # Utility functions
│   │   └── ApiKeyManager.ts # Handles API key management
│   ├── ui/                  # UI components (to be implemented)
│   └── index.ts             # Main entry point
├── tests/                   # Tests directory
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
├── cursor.config.json       # Cursor plugin configuration
└── README.md                # Project documentation
```

## Installation

### Prerequisites

- Cursor IDE (version 0.20.0 or later)
- Node.js (version 14 or later)
- API keys for the LLM providers you want to use:
  - OpenAI API key
  - Anthropic API key
  - Google AI API key

### Development Setup

1. Clone the repository

   ```
   git clone https://github.com/yourusername/poe.git
   cd poe
   ```

2. Install dependencies

   ```
   npm install
   ```

3. Build the plugin

   ```
   npm run build
   ```

4. Link the plugin to Cursor (replace with appropriate Cursor plugin linking instructions)

   ```
   # For example:
   ln -s /path/to/poe /path/to/cursor/plugins/
   ```

5. Configure API keys in Cursor settings
   - Open Cursor Settings
   - Navigate to Extensions > Panel of Experts
   - Add your API keys for each provider

## Usage

1. Open Cursor IDE
2. Click on the "Panel of Experts" icon in the sidebar
3. Configure your expert panel:
   - Set the discussion goal/question
   - Choose which expert personas to include
   - Select LLM providers for each expert
4. Start the conversation by typing a question or prompt
5. Watch as the experts discuss and collaborate on a solution
6. Toggle auto-discussion mode to let experts debate automatically
7. Use the moderator to guide the conversation when needed

## Key Concepts

- **Expert Agents**: Each LLM takes on a specific persona with unique perspectives and expertise.
- **Moderator Agent**: Guides the conversation, prevents tangents, and ensures the discussion stays productive.
- **Conversation Orchestrator**: Manages the flow of conversation between experts and moderator.
- **Provider Manager**: Abstracts the differences between LLM APIs for seamless integration.

## Configuration Options

- **API Keys**: Set your OpenAI, Anthropic, and Google API keys
- **Default Models**: Configure which models to use for each provider
- **Expert Personas**: Define custom expert roles and their personalities
- **Auto-discuss Mode**: Enable/disable automatic conversation between experts
- **Maximum Turns**: Set limits on conversation length

## Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)

- [ ] Complete base agent implementations
  - [ ] Implement BaseAgent abstract class
  - [ ] Complete ExpertAgent with role-based prompting
  - [ ] Implement ModeratorAgent with conversation management
- [ ] Provider Integration
  - [ ] Complete OpenAI provider implementation
  - [ ] Implement Anthropic provider
  - [ ] Add Google AI provider
  - [ ] Create ProviderManager for unified API access
- [ ] Basic Conversation Orchestration
  - [ ] Implement turn-based conversation flow
  - [ ] Add basic error handling and retry logic
  - [ ] Implement conversation state management

### Phase 2: UI Implementation (Weeks 3-4)

- [ ] Basic UI Components
  - [ ] Create panel discussion view
  - [ ] Implement expert selection interface
  - [ ] Add conversation controls
  - [ ] Design and implement settings panel
- [ ] Real-time Updates
  - [ ] Implement streaming response display
  - [ ] Add typing indicators
  - [ ] Create message threading visualization
- [ ] User Experience
  - [ ] Add keyboard shortcuts
  - [ ] Implement drag-and-drop expert reordering
  - [ ] Create conversation history view

### Phase 3: Advanced Features (Weeks 5-6)

- [ ] Session Management
  - [ ] Implement conversation saving/loading
  - [ ] Add export functionality
  - [ ] Create conversation templates
- [ ] Expert Persona System
  - [ ] Create persona configuration interface
  - [ ] Implement custom persona creation
  - [ ] Add persona sharing capabilities
- [ ] Code Context Integration
  - [ ] Add code reference capabilities
  - [ ] Implement syntax highlighting
  - [ ] Create code snippet sharing

### Phase 4: Polish and Optimization (Weeks 7-8)

- [ ] Performance Optimization
  - [ ] Implement response caching
  - [ ] Add request batching
  - [ ] Optimize UI rendering
- [ ] Testing and Documentation
  - [ ] Add unit tests for core components
  - [ ] Create integration tests
  - [ ] Write comprehensive documentation
- [ ] Local Model Support
  - [ ] Add support for local LLM models
  - [ ] Implement model switching
  - [ ] Create model comparison tools

## Implementation Priorities

1. **Core Agent System**

   - Focus on creating robust base agent implementations
   - Ensure proper error handling and retry mechanisms
   - Implement role-based prompting system

2. **Provider Integration**

   - Start with OpenAI integration as the primary provider
   - Add Anthropic and Google providers in parallel
   - Create a unified provider interface

3. **Basic UI**

   - Implement essential UI components first
   - Focus on conversation display and controls
   - Add settings management

4. **Conversation Management**

   - Implement basic conversation flow
   - Add state management
   - Create conversation history

5. **Advanced Features**
   - Add session management
   - Implement expert persona system
   - Integrate code context

## Development Guidelines

1. **Code Organization**

   - Follow TypeScript best practices
   - Maintain clear separation of concerns
   - Use dependency injection for flexibility

2. **Testing Strategy**

   - Write unit tests for core components
   - Create integration tests for provider interactions
   - Implement end-to-end tests for critical flows

3. **Documentation**

   - Keep README updated with implementation progress
   - Document API interfaces and configurations
   - Create user guides for new features

4. **Performance Considerations**
   - Implement efficient state management
   - Use streaming responses where possible
   - Optimize provider API calls

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
