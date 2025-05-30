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

## Installation

### Prerequisites

- Cursor IDE (version 0.20.0 or later)
- Node.js (version 14 or later)
- API keys for the LLM providers you want to use:
  - OpenAI API key
  - Anthropic API key
  - Google AI API key

### Quick Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the plugin**:
   ```bash
   npm run build
   ```

3. **Link to Cursor**:
   ```bash
   ln -s "$(pwd)" ~/.cursor/extensions/fluidmind.poe
   ```

4. **Restart Cursor completely** (Quit and reopen)

## Usage

1. Open Cursor IDE
2. Click on the "Panel of Experts" icon in the sidebar
3. Configure your expert panel:
   - Set the discussion goal/question
   - Choose which expert personas to include
   - Select LLM providers for each expert
4. Start the conversation by typing a question or prompt
5. Watch as the experts discuss and collaborate on a solution

## Commands

- **Start Panel of Experts Discussion**: Begin a new panel discussion
- **Toggle Auto-Discussion Mode**: Enable/disable AI experts automatically responding to each other
- **Reset Conversation**: Clear the current discussion and start fresh

For detailed instructions, see [instructions.md](./instructions.md).

## License

MIT 