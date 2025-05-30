# Panel of Experts (POE) - Cursor Plugin

This document provides instructions for building, installing, and using the Panel of Experts plugin for Cursor IDE.

## Overview

The Panel of Experts plugin creates a collaborative discussion between multiple AI models from different providers (OpenAI, Anthropic, Google), each taking on a distinct expert role to solve problems and provide insights.

## Building the Plugin

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the plugin**:
   ```bash
   npm run build
   ```

3. **Watch for changes during development**:
   ```bash
   npm run dev
   ```

## Installing the Plugin in Cursor

1. **Create a symlink to Cursor's extensions directory**:
   ```bash
   ln -s "$(pwd)" ~/.cursor/extensions/fluidmind.poe
   ```

2. **Restart Cursor completely** (Quit and reopen, not just closing the window)

## Using the Plugin

Once installed, you can use these commands:

1. **Start a new panel discussion**:
   - Open the command palette (Cmd+Shift+P on Mac, Ctrl+Shift+P on Windows/Linux)
   - Type "Start Panel of Experts Discussion" and select it

2. **Toggle auto-discussion mode**:
   - Open the command palette
   - Type "Toggle Auto-Discussion Mode" and select it
   - This enables/disables AI experts automatically responding to each other

3. **Reset the conversation**:
   - Open the command palette
   - Type "Reset Conversation" and select it
   - This clears the current discussion and starts fresh

## Configuring the Plugin

You can configure the plugin by editing your Cursor settings:

1. Open Cursor settings
2. Search for "Panel of Experts"
3. Configure your API keys:
   - OpenAI API Key
   - Anthropic API Key
   - Google AI API Key
4. Configure default models for each provider
5. Set other options like auto-discussion mode and maximum conversation length

## Troubleshooting

If you encounter issues with the plugin:

1. **Plugin not showing up in Cursor**:
   - Verify the symlink is correctly created
   - Check Cursor's developer console for errors
   - Make sure you've completely restarted Cursor

2. **Commands not working**:
   - Check the developer console for error messages
   - Verify your API keys are set correctly

3. **Removing the plugin**:
   - Delete the symlink:
     ```bash
     rm ~/.cursor/extensions/fluidmind.poe
     ```
   - Edit ~/.cursor/extensions/extensions.json to remove the plugin entry
   - Restart Cursor

## Developer Commands

For development and debugging:

1. **Clean build**:
   ```bash
   rm -rf dist && npm run build
   ```

2. **Re-register the plugin**:
   ```bash
   rm -f ~/.cursor/extensions/fluidmind.poe && ln -s "$(pwd)" ~/.cursor/extensions/fluidmind.poe
   ```

3. **Check extension registration**:
   ```bash
   cat ~/.cursor/extensions/extensions.json
   ```

4. **Fix multiple registrations**:
   ```bash
   cp ~/.cursor/extensions/extensions.json ~/.cursor/extensions/extensions.json.bak && 
   cat ~/.cursor/extensions/extensions.json | jq 'map(select(.identifier.id != "undefined_publisher.poe"))' > /tmp/new_extensions.json && 
   cat /tmp/new_extensions.json > ~/.cursor/extensions/extensions.json
   ```

5. **Run linting**:
   ```bash
   npm run lint
   ``` 