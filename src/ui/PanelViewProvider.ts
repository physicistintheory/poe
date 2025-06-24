import * as vscode from 'vscode';
import { ConversationOrchestrator } from '../orchestration/ConversationOrchestrator';
import { ConversationSession } from '../types';
import { PanelConfig, ProviderType } from '../types';

// Reference to the shared output channel
let outputChannel: vscode.OutputChannel;

/**
 * Set the output channel for logging
 */
export function setOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel;
}

/**
 * WebviewViewProvider for the Panel of Experts view
 */
export class PanelViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _orchestrator?: ConversationOrchestrator;
    private _onViewReady: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onViewReady: vscode.Event<void> = this._onViewReady.event;
    private _sessions: ConversationSession[] = [];
    private _panels: PanelConfig[] = [];
    private _currentPanel?: PanelConfig;
    private _context: vscode.ExtensionContext;
    private _availableModels: Record<string, string[]> = {};

    constructor(private readonly _extensionUri: vscode.Uri, context?: vscode.ExtensionContext) {
        if (outputChannel) {
            outputChannel.appendLine('PanelViewProvider constructor called');
        } else {
            console.log('PanelViewProvider constructor called');
        }
        this._context = context!;
        this._initializeDefaultPanels();
        this.loadPanelsFromStorage();
    }

    private loadPanelsFromStorage(): void {
        try {
            if (!this._context) {
                if (outputChannel) {
                    outputChannel.appendLine('ERROR: No context available for loading panels');
                }
                this._initializeDefaultPanels();
                return;
            }
            
            const stored = this._context?.globalState.get('poe.panels', []);
            if (outputChannel) {
                outputChannel.appendLine(`Loading panels from storage - Context available: ${!!this._context}`);
                outputChannel.appendLine(`Raw stored data type: ${typeof stored}, Array: ${Array.isArray(stored)}`);
                outputChannel.appendLine(`Stored panel count: ${Array.isArray(stored) ? stored.length : 'NOT_ARRAY'}`);
            }
            
            // VS Code globalState handles JSON deserialization automatically
            this._panels = Array.isArray(stored) ? stored as PanelConfig[] : [];
            
            if (outputChannel) {
                outputChannel.appendLine(`Loaded ${this._panels.length} panels from storage: ${this._panels.map(p => p.name).join(', ')}`);
            }
            
            // If no panels are stored, initialize with defaults
            if (this._panels.length === 0) {
                this._initializeDefaultPanels();
                if (outputChannel) {
                    outputChannel.appendLine('No panels in storage, initialized with defaults');
                }
            }
            
            // Restore the previously selected panel if available
            const storedCurrentPanelId = this._context?.globalState.get('poe.currentPanelId', '');
            if (outputChannel) {
                outputChannel.appendLine(`Stored current panel ID: "${storedCurrentPanelId}"`);
            }
            
            if (storedCurrentPanelId) {
                const storedPanel = this._panels.find(p => p.id === storedCurrentPanelId);
                if (storedPanel) {
                    this._currentPanel = storedPanel;
                    if (outputChannel) {
                        outputChannel.appendLine(`Restored current panel: ${storedPanel.name} (${storedCurrentPanelId})`);
                    }
                } else {
                    // If the stored panel ID doesn't exist anymore, default to first panel
                    this._currentPanel = this._panels[0];
                    if (outputChannel) {
                        outputChannel.appendLine(`Stored panel ID ${storedCurrentPanelId} not found, defaulted to first panel: ${this._panels[0]?.name}`);
                    }
                }
            } else {
                // No stored selection, default to first panel
                this._currentPanel = this._panels[0];
                if (outputChannel) {
                    outputChannel.appendLine(`No stored panel selection, defaulted to first panel: ${this._panels[0]?.name}`);
                }
            }
            
            // Populate models for panels that don't have them set (async, don't await)
            this.populatePanelModels().catch(error => {
                console.error('Error populating panel models:', error);
            });
        } catch (error) {
            console.error('Error loading panels from storage:', error);
            if (outputChannel) {
                outputChannel.appendLine(`ERROR loading panels from storage: ${error}`);
            }
            this._initializeDefaultPanels();
        }
    }

    /**
     * Populate models for panels that don't have them set
     */
    private async populatePanelModels(): Promise<void> {
        try {
            const availableModels = await this.getAvailableModels();
            
            // Log which providers have models available
            for (const [provider, models] of Object.entries(availableModels)) {
                if (models.length === 0) {
                    if (outputChannel) {
                        outputChannel.appendLine(`Warning: No models available for provider ${provider}`);
                    }
                } else {
                    if (outputChannel) {
                        outputChannel.appendLine(`Found ${models.length} models for provider ${provider}: ${models.join(', ')}`);
                    }
                }
            }
            
            this._panels = this._panels.map(panel => {
                // Update experts
                const updatedExperts = panel.experts.map(expert => {
                    if (!expert.model && availableModels[expert.provider] && availableModels[expert.provider].length > 0) {
                        return { ...expert, model: availableModels[expert.provider][0] };
                    }
                    return expert;
                });
                
                // Update moderator
                let updatedModerator = panel.moderator;
                if (!panel.moderator.model && availableModels[panel.moderator.provider] && availableModels[panel.moderator.provider].length > 0) {
                    updatedModerator = { ...panel.moderator, model: availableModels[panel.moderator.provider][0] };
                }
                
                return {
                    ...panel,
                    experts: updatedExperts,
                    moderator: updatedModerator
                };
            });
            
            // Save updated panels
            this.savePanelsToStorage();
        } catch (error) {
            console.error('Error populating panel models:', error);
            if (outputChannel) {
                outputChannel.appendLine(`Error populating panel models: ${error}`);
            }
        }
    }

    private savePanelsToStorage(): void {
        try {
            if (!this._context) {
                if (outputChannel) {
                    outputChannel.appendLine('ERROR: No context available for saving panels');
                }
                return;
            }
            
            if (outputChannel) {
                outputChannel.appendLine(`Saving panels to storage - Context available: ${!!this._context}`);
                outputChannel.appendLine(`Panel count being saved: ${this._panels.length}`);
                outputChannel.appendLine(`Panel names being saved: ${this._panels.map(p => p.name).join(', ')}`);
            }
            
            // VS Code globalState handles JSON serialization automatically
            this._context.globalState.update('poe.panels', this._panels);
            
            if (outputChannel) {
                // Verify the save by immediately reading it back
                const verification = this._context.globalState.get('poe.panels', []);
                outputChannel.appendLine(`Verification read after save: ${Array.isArray(verification) ? verification.length : 'NOT_ARRAY'} panels`);
                outputChannel.appendLine(`Saved ${this._panels.length} panels to globalState: ${this._panels.map(p => p.name).join(', ')}`);
            }
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine(`ERROR saving panels to storage: ${error}`);
            }
        }
    }

    /**
     * Initialize default panel configurations
     */
    private _initializeDefaultPanels(): void {
        this._panels = [
            {
                id: 'default-panel',
                name: 'Default Panel',
                description: 'Standard panel with backend engineer, creative brainstormer, and code optimizer',
                experts: [
                    {
                        id: 'expert-1',
                        name: 'Backend Engineer',
                        provider: ProviderType.OLLAMA,
                        model: '',
                        persona: `You are a veteran software engineer with extensive backend experience. 
    You focus on architectural decisions, code quality, and performance optimizations.
    You value reliable, scalable, and maintainable solutions over quick hacks.`,
                        specialization: 'Backend architecture and system design',
                        color: '#4285F4',
                        temperature: 0.7,
                        maxTokens: 4000
                    },
                    {
                        id: 'expert-2',
                        name: 'Creative Brainstormer',
                        provider: ProviderType.OLLAMA,
                        model: '',
                        persona: `You are an innovative thinker who excels at generating creative solutions.
    You think outside the box and challenge assumptions.
    You're skilled at finding unconventional approaches to problems.`,
                        specialization: 'Creative problem-solving and ideation',
                        color: '#EA4335',
                        temperature: 0.9,
                        maxTokens: 4000
                    },
                    {
                        id: 'expert-3',
                        name: 'Code Optimizer',
                        provider: ProviderType.OLLAMA,
                        model: '',
                        persona: `You are an efficiency-focused developer who specializes in optimizing code.
    You can spot inefficient patterns and suggest improvements.
    You balance readability with performance considerations.`,
                        specialization: 'Performance optimization and refactoring',
                        color: '#34A853',
                        temperature: 0.5,
                        maxTokens: 4000
                    }
                ],
                moderator: {
                    id: 'moderator-1',
                    name: 'Discussion Moderator',
                    provider: ProviderType.OLLAMA,
                    model: '',
                    systemPrompt: 'Facilitate productive discussion and ensure all experts contribute meaningfully'
                }
            }
        ];
        
        this._currentPanel = this._panels[0];
    }

    /**
     * Get all panels
     */
    get panels(): PanelConfig[] {
        return this._panels;
    }
    
    /**
     * Add a new panel to the list
     */
    addPanel(panel: PanelConfig): void {
        const existingIndex = this._panels.findIndex(p => p.id === panel.id);
        if (existingIndex >= 0) {
            this._panels[existingIndex] = panel;
        } else {
            this._panels.push(panel);
        }
        this.savePanelsToStorage();
        if (outputChannel) {
            outputChannel.appendLine(`Panel ${existingIndex >= 0 ? 'updated' : 'added'} with ID: ${panel.id}`);
        }
        this._updateView();
    }

    /**
     * Set the current panel
     */
    setCurrentPanel(panelId: string): void {
        const panel = this._panels.find(p => p.id === panelId);
        if (panel) {
            this._currentPanel = panel;
            // Save the current panel selection to storage
            this._context.globalState.update('poe.currentPanelId', panelId);
            if (outputChannel) {
                outputChannel.appendLine(`Set current panel to: ${panel.name} (${panelId})`);
            }
            
            // Create a new conversation with the selected panel's configuration
            // This ensures the orchestrator uses the correct experts and moderator
            vscode.commands.executeCommand('poe.startPanel')
                .then(() => {
                    if (outputChannel) {
                        outputChannel.appendLine(`Created new conversation for panel: ${panel.name}`);
                    }
                }, (error: Error) => {
                    if (outputChannel) {
                        outputChannel.appendLine(`Error creating conversation for panel ${panel.name}: ${error.message}`);
                    }
                });
            
            this._updateView();
        }
    }

    /**
     * Get the current panel
     */
    getCurrentPanel(): PanelConfig | undefined {
        return this._currentPanel;
    }

    /**
     * Get all sessions
     */
    get sessions(): ConversationSession[] {
        return this._sessions;
    }
    
    /**
     * Add a new session to the list
     */
    addSession(session: ConversationSession): void {
        // Check if session already exists
        const existingIndex = this._sessions.findIndex(s => s.id === session.id);
        if (existingIndex >= 0) {
            // Update existing session
            this._sessions[existingIndex] = session;
        } else {
            // Add new session
            this._sessions.push(session);
        }
        
        if (outputChannel) {
            outputChannel.appendLine(`Session ${existingIndex >= 0 ? 'updated' : 'added'} with ID: ${session.id}`);
            outputChannel.appendLine(`Total sessions: ${this._sessions.length}`);
        }
        
        // Update the view
        this._updateView();
    }

    /**
     * Set the active orchestrator
     */
    setOrchestrator(orchestrator: ConversationOrchestrator | undefined): void {
        if (outputChannel) {
            outputChannel.appendLine('PanelViewProvider.setOrchestrator called' + (orchestrator ? ' with orchestrator' : ' with undefined'));
        } else {
            console.log('PanelViewProvider.setOrchestrator called', orchestrator ? 'with orchestrator' : 'with undefined');
        }
        this._orchestrator = orchestrator;
        
        // Register message listener if orchestrator is defined
        if (orchestrator) {
            // Listen for new messages to update the view
            orchestrator.onMessage(() => {
                this._updateView();
            });
            
            // Add the current session to our sessions list
            const session = orchestrator.getSession();
            this.addSession(session);
        }
        
        // Only update the view if it's available
        if (this._view) {
            outputChannel.appendLine('View is available, updating immediately');
            this._updateView();
        } else {
            outputChannel.appendLine('View is NOT available yet, will update when ready');
        }
    }

    /**
     * Required method to resolve the webview view
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        if (outputChannel) {
            outputChannel.appendLine('PanelViewProvider.resolveWebviewView called');
            outputChannel.appendLine(`WebviewView state: ${webviewView.visible ? 'visible' : 'not visible'}`);
        } else {
            console.log('PanelViewProvider.resolveWebviewView called');
        }
        
        try {
            this._view = webviewView;

            // Set options for the webview
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri]
            };

            // Set initial content
            webviewView.webview.html = this._getHtmlContent();
            
            // Notify that the view is ready
            this._onViewReady.fire();
            
            // Listen for visibility changes
            webviewView.onDidChangeVisibility(() => {
                
                if (webviewView.visible) {
                    // Update view when it becomes visible
                    this._updateView();
                }
            });

            // Handle messages from the webview
            webviewView.webview.onDidReceiveMessage(message => {
                
                // Handle message based on type
                if (message.type === 'sendMessage' && this._orchestrator) {
                    this._orchestrator.addUserMessage(message.text);
                } else if (message.type === 'switchSession') {
                    this._handleSessionSwitch(message.sessionId);
                } else if (message.type === 'createSession') {
                    this._handleCreateSession();
                } else if (message.type === 'switchPanel') {
                    this._handlePanelSwitch(message.panelId);
                } else if (message.type === 'createPanel') {
                    this._handleCreatePanel();
                } else if (message.type === 'savePanel') {
                    this.addPanel(message.panel);
                    this.setCurrentPanel(message.panel.id);
                } else if (message.type === 'cancelPanel') {
                    // Just revert to the first/default panel
                    if (this._panels.length > 0) {
                        this.setCurrentPanel(this._panels[0].id);
                    }
                } else if (message.type === 'viewReady') {
                    // The webview is fully loaded and ready
                    this._updateView();
                }
            });
            
            if (outputChannel) {
                outputChannel.appendLine('PanelViewProvider.resolveWebviewView completed');
            } else {
                console.log('PanelViewProvider.resolveWebviewView completed');
            }
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine('Error in resolveWebviewView: ' + error);
            } else {
                console.error('Error in resolveWebviewView:', error);
            }
            
            // Try to set a fallback UI
            if (webviewView && webviewView.webview) {
                webviewView.webview.html = this._getErrorHtml(error);
            }
        }
    }

    /**
     * Handle session switching
     */
    private _handleSessionSwitch(sessionId: string): void {
        // Find the session in our sessions list
        const session = this._sessions.find(s => s.id === sessionId);
        if (!session) {
            if (outputChannel) {
                outputChannel.appendLine(`Session with ID ${sessionId} not found`);
            }
            return;
        }

        // Notify external components about session switch
        vscode.commands.executeCommand('poe.switchSession', session);
    }

    /**
     * Handle creating a new session
     */
    private _handleCreateSession(): void {
        vscode.commands.executeCommand('poe.startPanel')
            .then(() => {
                if (outputChannel) {
                    outputChannel.appendLine('Created new session from panel button');
                }
                this._updateView();
            })
            .then(undefined, (error: Error) => {
                if (outputChannel) {
                    outputChannel.appendLine('Error creating new session: ' + error.message);
                }
                vscode.window.showErrorMessage('Failed to create new session: ' + error.message);
            });
    }

    /**
     * Handle panel switching
     */
    private _handlePanelSwitch(panelId: string): void {
        if (outputChannel) {
            outputChannel.appendLine(`_handlePanelSwitch called with panelId: ${panelId}`);
        }
        
        if (panelId === 'create-new') {
            this._handleCreatePanel();
        } else {
            this.setCurrentPanel(panelId);
            if (outputChannel) {
                outputChannel.appendLine(`Switched to panel: ${panelId}`);
            }
        }
    }

    /**
     * Handle creating a new panel
     */
    private async _handleCreatePanel(): Promise<void> {
        // Set a special "create-new" panel state to trigger the form
        this._currentPanel = {
            id: 'create-new',
            name: 'Create A New Panel of Experts',
            description: 'Configure a new panel of experts',
            experts: [],
            moderator: {
                id: 'moderator-1',
                name: 'Discussion Moderator',
                provider: ProviderType.OLLAMA,
                model: '', // Will be populated dynamically
                systemPrompt: 'Facilitate productive discussion and ensure all experts contribute meaningfully'
            }
        };
        // Fetch models and send to webview
        this._availableModels = await this.getAvailableModels();
        this._updateView();
        if (this._view) {
            this._view.webview.postMessage({ type: 'availableModels', models: this._availableModels });
        }
        if (outputChannel) {
            outputChannel.appendLine('User requested to create new panel - showing form');
        }
    }

    /**
     * Update the webview content
     */
    private _updateView() {
        if (!this._view) {
            if (outputChannel) {
                outputChannel.appendLine('_updateView called but view is not available');
            }
            return;
        }

        try {
            // Create HTML content
            const html = this._getHtmlContent();
            this._view.webview.html = html;
            
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine('Error updating view: ' + error);
            } else {
                console.error('Error updating view:', error);
            }
            // Provide a fallback UI in case of error
            this._view.webview.html = this._getErrorHtml(error);
        }
    }

    /**
     * Generate HTML content for error cases
     */
    private _getErrorHtml(error: Error | unknown): string {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Panel of Experts - Error</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 10px;
            color: #eee;
            background-color: #333;
        }
        .error {
            color: #ff6b6b;
            background-color: #440000;
            padding: 12px;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>Panel of Experts</h1>
    <div class="error">
        <h3>Error loading panel content</h3>
        <p>${errorMessage}</p>
        <p>Try restarting the Panel of Experts or check the extension logs.</p>
    </div>
    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            // Report that view is ready
            vscode.postMessage({
                type: 'viewReady'
            });
        })();
    </script>
</body>
</html>`;
    }

    /**
     * Generate HTML content for the webview
     */
    private _getHtmlContent(): string {
        try {
            // Check if we have an orchestrator
            const hasOrchestrator = !!this._orchestrator;
            
            const currentSession = hasOrchestrator && this._orchestrator ? this._orchestrator.getSession() : undefined;
            const messages = currentSession?.messages || [];
            
            // Get all available sessions
            const allSessions: ConversationSession[] = this._sessions;
            const allPanels: PanelConfig[] = this._panels;
            
            // At the top of _getHtmlContent, add a flag to check if we are in panel creation mode
            const isCreatingPanel = this._currentPanel && this._currentPanel.id === 'create-new';
            
            // Generate panel selector HTML
            let panelSelectorHtml = '';
            if (allPanels.length > 0) {
                panelSelectorHtml = `
                <div class="panel-selector">
                    <label for="panel-select">Select Panel:</label>
                    <select id="panel-select">
                        ${allPanels.map(panel => {
                            const isSelected = this._currentPanel && panel.id === this._currentPanel.id;
                            return `<option value="${panel.id}" ${isSelected ? 'selected' : ''}>${panel.name}</option>`;
                        }).join('')}
                        <option value="create-new">Create A New Panel of Experts</option>
                    </select>
                </div>`;
            } else {
                panelSelectorHtml = `
                <div class="panel-selector">
                    <p>No panels available.</p>
                    <button id="create-panel-button">Create New Panel</button>
                </div>`;
            }
            
            // Generate session selector HTML
            let sessionSelectorHtml = '';
            if (allSessions.length > 0) {
                sessionSelectorHtml = `
                <div class="session-selector">
                    <label for="session-select">Select Session:</label>
                    <select id="session-select">
                        ${allSessions.map(session => {
                            const isSelected = currentSession && session.id === currentSession.id;
                            return `<option value="${session.id}" ${isSelected ? 'selected' : ''}>${session.title}</option>`;
                        }).join('')}
                    </select>
                    <button id="create-session-button">New Session</button>
                </div>`;
            } else {
                // Provide a message when no sessions are available
                sessionSelectorHtml = `
                <div class="session-selector">
                    <p>No sessions available. Use the "Start Panel of Experts Discussion" command to create one.</p>
                    <button id="create-session-button">Create New Session</button>
                </div>`;
            }

            // Generate message HTML
            let messagesHtml = '';
            if (hasOrchestrator && messages.length > 0) {
                
                messagesHtml = messages.map(msg => {
                    const role = msg.sender.role.toLowerCase();
                    const id = msg.sender.id;
                    const className = role === 'expert' ? id : role;
                    
                    return `
                    <div class="message ${className}">
                        <div class="sender">${msg.sender.name}</div>
                        <div class="content">${msg.content}</div>
                    </div>
                    `;
                }).join('');
            } else {
                if (outputChannel) {
                    outputChannel.appendLine('PanelViewProvider._getHtmlContent: Generating no-session HTML');
                } else {
                    console.log('PanelViewProvider._getHtmlContent: Generating no-session HTML');
                }
                messagesHtml = `<div class="no-session">
                    <p>No active discussion session.</p>
                    <p>Use the command palette to start a new panel discussion.</p>
                    <p><code>Cmd+Shift+P</code> → "Start Panel of Experts Discussion"</p>
                </div>`;
            }
            
            // Panel creation form HTML
            let panelCreationHtml = '';
            if (isCreatingPanel) {
                panelCreationHtml = this.getPanelCreationFormHtml();
            }
            
            // Create a simple HTML structure for testing
            return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Panel of Experts</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                padding: 10px;
                color: #eee;
                background-color: #333;
            }
            .message {
                margin-bottom: 10px;
                padding: 8px 12px;
                border-radius: 6px;
                background-color: #444;
                border-left: 3px solid #999;
            }
            .no-session {
                text-align: center;
                margin-top: 40px;
                color: #999;
            }
            .panel-selector {
                margin-bottom: 15px;
                padding: 10px;
                background-color: #3a3a3a;
                border-radius: 4px;
            }
            .panel-selector select {
                width: 80%;
                padding: 6px;
                background-color: #444;
                color: #eee;
                border: 1px solid #555;
                border-radius: 4px;
                margin-top: 5px;
            }
            .session-selector {
                margin-bottom: 15px;
                padding: 10px;
                background-color: #3a3a3a;
                border-radius: 4px;
            }
            .session-selector select {
                width: 80%;
                padding: 6px;
                background-color: #444;
                color: #eee;
                border: 1px solid #555;
                border-radius: 4px;
                margin-top: 5px;
            }
            #create-panel-button, #create-session-button {
                display: inline-block;
                padding: 6px 10px;
                margin-left: 10px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            .sender {
                font-weight: bold;
                margin-bottom: 5px;
            }
            .content {
                white-space: pre-wrap;
            }
        </style>
    </head>
    <body>
        <h1>Panel of Experts</h1>
        
        ${panelSelectorHtml}
        
        ${sessionSelectorHtml}
        
        <div id="messages-container">
            ${messagesHtml}
        </div>
        
        ${hasOrchestrator ? 
            `<div style="margin-top: 20px; display: flex;">
                <input type="text" id="message-input" placeholder="Type a message..." 
                       style="flex-grow: 1; padding: 8px; border: 1px solid #666; background-color: #444; color: #eee; border-radius: 4px;">
                <button id="send-button" 
                        style="margin-left: 8px; padding: 8px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Send
                </button>
            </div>` 
            : ''
        }
        
        ${panelCreationHtml}
        
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                const messageInput = document.getElementById('message-input');
                const sendButton = document.getElementById('send-button');
                const sessionSelect = document.getElementById('session-select');
                const createSessionButton = document.getElementById('create-session-button');
                const panelSelect = document.getElementById('panel-select');
                const createPanelButton = document.getElementById('create-panel-button');
                
                // Notify that the view is ready
                vscode.postMessage({
                    type: 'viewReady'
                });
                
                if (sendButton && messageInput) {
                    sendButton.addEventListener('click', () => {
                        const text = messageInput.value.trim();
                        if (text) {
                            vscode.postMessage({
                                type: 'sendMessage',
                                text: text
                            });
                            messageInput.value = '';
                        }
                    });
                    
                    messageInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            const text = messageInput.value.trim();
                            if (text) {
                                vscode.postMessage({
                                    type: 'sendMessage',
                                    text: text
                                });
                                messageInput.value = '';
                            }
                        }
                    });
                }
                
                if (panelSelect) {
                    panelSelect.addEventListener('change', (e) => {
                        const panelId = panelSelect.value;
                        if (panelId === 'create-new') {
                            vscode.postMessage({
                                type: 'createPanel'
                            });
                        } else if (panelId) {
                            vscode.postMessage({
                                type: 'switchPanel',
                                panelId: panelId
                            });
                        }
                    });
                }
                
                if (sessionSelect) {
                    sessionSelect.addEventListener('change', (e) => {
                        const sessionId = sessionSelect.value;
                        if (sessionId) {
                            vscode.postMessage({
                                type: 'switchSession',
                                sessionId: sessionId
                            });
                        }
                    });
                }
                
                if (createPanelButton) {
                    createPanelButton.addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'createPanel'
                        });
                    });
                }
                
                if (createSessionButton) {
                    createSessionButton.addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'createSession'
                        });
                    });
                }

                // Panel creation logic
                const panelCreationForm = document.getElementById('panel-creation-form');
                const addExpertBtn = document.getElementById('add-expert-btn');
                const expertsList = document.getElementById('experts-list');
                const cancelPanelBtn = document.getElementById('cancel-panel-btn');
                const moderatorProviderSelect = document.getElementById('moderator-provider');
                const moderatorModelSelect = document.getElementById('moderator-model');
                let expertCount = 0;
                let expertData = [];
                
                // Available providers and models (will be updated from backend)
                let availableProviders = [];
                let availableModels = {};
                
                // Listen for availableModels message from backend
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'availableModels') {
                        availableModels = message.models;
                        availableProviders = Object.keys(availableModels);
                        renderExperts();
                        // Also update moderator provider/model dropdowns
                        populateProviderDropdown(moderatorProviderSelect);
                        if (moderatorProviderSelect) {
                            moderatorProviderSelect.addEventListener('change', function() {
                                populateModelDropdown(moderatorModelSelect, this.value);
                            });
                        }
                    }
                });
                
                function collectExpertData() {
                    const data = [];
                    for (let i = 0; i < expertCount; i++) {
                        const nameEl = document.querySelector('.expert-name[data-index="' + i + '"]');
                        const providerEl = document.querySelector('.expert-provider[data-index="' + i + '"]');
                        const modelEl = document.querySelector('.expert-model[data-index="' + i + '"]');
                        const personaEl = document.querySelector('.expert-persona[data-index="' + i + '"]');
                        const specializationEl = document.querySelector('.expert-specialization[data-index="' + i + '"]');
                        const temperatureEl = document.querySelector('.expert-temperature[data-index="' + i + '"]');
                        const maxTokensEl = document.querySelector('.expert-max-tokens[data-index="' + i + '"]');
                        
                        if (nameEl && providerEl && modelEl && personaEl && specializationEl && temperatureEl && maxTokensEl) {
                            data.push({
                                name: nameEl.value,
                                provider: providerEl.value,
                                model: modelEl.value,
                                persona: personaEl.value,
                                specialization: specializationEl.value,
                                temperature: temperatureEl.value,
                                maxTokens: maxTokensEl.value
                            });
                        }
                    }
                    return data;
                }
                
                function restoreExpertData() {
                    for (let i = 0; i < expertData.length && i < expertCount; i++) {
                        const data = expertData[i];
                        const nameEl = document.querySelector('.expert-name[data-index="' + i + '"]');
                        const providerEl = document.querySelector('.expert-provider[data-index="' + i + '"]');
                        const modelEl = document.querySelector('.expert-model[data-index="' + i + '"]');
                        const personaEl = document.querySelector('.expert-persona[data-index="' + i + '"]');
                        const specializationEl = document.querySelector('.expert-specialization[data-index="' + i + '"]');
                        const temperatureEl = document.querySelector('.expert-temperature[data-index="' + i + '"]');
                        const maxTokensEl = document.querySelector('.expert-max-tokens[data-index="' + i + '"]');
                        
                        if (nameEl) nameEl.value = data.name || '';
                        if (personaEl) personaEl.value = data.persona || '';
                        if (specializationEl) specializationEl.value = data.specialization || '';
                        if (temperatureEl) temperatureEl.value = data.temperature || '0.7';
                        if (maxTokensEl) maxTokensEl.value = data.maxTokens || '4000';
                        
                        if (providerEl) {
                            providerEl.value = data.provider || '';
                            // Trigger change event to populate model dropdown
                            if (data.provider) {
                                populateModelDropdown(modelEl, data.provider);
                                setTimeout(() => {
                                    if (modelEl) modelEl.value = data.model || '';
                                }, 10);
                            }
                        }
                    }
                }
                
                function populateProviderDropdown(selectElement) {
                    if (!selectElement) return;
                    selectElement.innerHTML = '<option value="">Select Provider</option>';
                    availableProviders.forEach(provider => {
                        const option = document.createElement('option');
                        option.value = provider;
                        option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
                        selectElement.appendChild(option);
                    });
                }
                
                function populateModelDropdown(selectElement, provider) {
                    if (!selectElement) return;
                    selectElement.innerHTML = '<option value="">Select Model</option>';
                    if (provider && availableModels[provider]) {
                        if (availableModels[provider].length === 0) {
                            const option = document.createElement('option');
                            option.value = '';
                            option.textContent = 'No models available';
                            option.disabled = true;
                            selectElement.appendChild(option);
                        } else {
                            availableModels[provider].forEach(model => {
                                const option = document.createElement('option');
                                option.value = model;
                                option.textContent = model;
                                selectElement.appendChild(option);
                            });
                        }
                    }
                }
                
                function renderExperts() {
                    if (!expertsList) return;
                    
                    // Collect current data before re-rendering
                    expertData = collectExpertData();
                    
                    expertsList.innerHTML = '';
                    for (let i = 0; i < expertCount; i++) {
                        const expertDiv = document.createElement('div');
                        expertDiv.className = 'expert-config';
                        expertDiv.style = 'border:1px solid #444;padding:8px;margin-bottom:8px;border-radius:4px;';
                        expertDiv.innerHTML = 
                            '<label>Name: <input type="text" class="expert-name" data-index="' + i + '" style="width:120px;"></label>' +
                            '<label>Provider: <select class="expert-provider" data-index="' + i + '" style="width:100px;"><option value="">Select Provider</option></select></label>' +
                            '<label>Model: <select class="expert-model" data-index="' + i + '" style="width:100px;"><option value="">Select Model</option></select></label>' +
                            '<label>Persona: <input type="text" class="expert-persona" data-index="' + i + '" style="width:180px;"></label>' +
                            '<label>Specialization: <input type="text" class="expert-specialization" data-index="' + i + '" style="width:120px;"></label>' +
                            '<label>Temperature: <input type="number" class="expert-temperature" data-index="' + i + '" min="0" max="2" step="0.01" value="0.7" style="width:60px;"></label>' +
                            '<label>Max Tokens: <input type="number" class="expert-max-tokens" data-index="' + i + '" value="4000" style="width:80px;"></label>' +
                            '<button type="button" class="remove-expert-btn" data-index="' + i + '">Remove</button>';
                        expertsList.appendChild(expertDiv);
                        
                        // Populate provider dropdown for this expert
                        const providerSelect = expertDiv.querySelector('.expert-provider');
                        populateProviderDropdown(providerSelect);
                        
                        // Add change listener to update model dropdown when provider changes
                        providerSelect.addEventListener('change', function() {
                            const modelSelect = expertDiv.querySelector('.expert-model');
                            populateModelDropdown(modelSelect, this.value);
                        });
                    }
                    
                    // Restore data after rendering
                    restoreExpertData();
                    
                    // Add event listeners for remove buttons
                    Array.from(document.getElementsByClassName('remove-expert-btn')).forEach(btn => {
                        btn.addEventListener('click', function() {
                            const idx = parseInt(this.getAttribute('data-index'));
                            expertCount--;
                            renderExperts();
                        });
                    });
                }
                
                // Initialize dropdowns
                populateProviderDropdown(moderatorProviderSelect);
                if (moderatorProviderSelect) {
                    moderatorProviderSelect.addEventListener('change', function() {
                        populateModelDropdown(moderatorModelSelect, this.value);
                    });
                }
                
                if (addExpertBtn) {
                    addExpertBtn.addEventListener('click', function() {
                        expertCount++;
                        renderExperts();
                    });
                }
                renderExperts();
                if (panelCreationForm) {
                    panelCreationForm.addEventListener('submit', function(e) {
                        e.preventDefault();
                        // Gather panel data
                        const panelName = document.getElementById('panel-name').value;
                        const panelDescription = document.getElementById('panel-description').value;
                        const moderatorName = document.getElementById('moderator-name').value;
                        const moderatorProvider = document.getElementById('moderator-provider').value;
                        const moderatorModel = document.getElementById('moderator-model').value;
                        const moderatorSystemPrompt = document.getElementById('moderator-system-prompt').value;
                        const experts = [];
                        for (let i = 0; i < expertCount; i++) {
                            experts.push({
                                id: 'expert-' + (i+1),
                                name: document.querySelector('.expert-name[data-index="' + i + '"]').value,
                                provider: document.querySelector('.expert-provider[data-index="' + i + '"]').value,
                                model: document.querySelector('.expert-model[data-index="' + i + '"]').value,
                                persona: document.querySelector('.expert-persona[data-index="' + i + '"]').value,
                                specialization: document.querySelector('.expert-specialization[data-index="' + i + '"]').value,
                                temperature: parseFloat(document.querySelector('.expert-temperature[data-index="' + i + '"]').value),
                                maxTokens: parseInt(document.querySelector('.expert-max-tokens[data-index="' + i + '"]').value)
                            });
                        }
                        vscode.postMessage({
                            type: 'savePanel',
                            panel: {
                                id: 'panel-' + Date.now(),
                                name: panelName,
                                description: panelDescription,
                                experts: experts,
                                moderator: {
                                    id: 'moderator-1',
                                    name: moderatorName,
                                    provider: moderatorProvider,
                                    model: moderatorModel,
                                    systemPrompt: moderatorSystemPrompt
                                }
                            }
                        });
                    });
                }
                if (cancelPanelBtn) {
                    cancelPanelBtn.addEventListener('click', function() {
                        vscode.postMessage({ type: 'cancelPanel' });
                    });
                }
            })();
        </script>
    </body>
    </html>`;
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine('Error generating HTML content: ' + error);
            } else {
                console.error('Error generating HTML content:', error);
            }
            
            // Return a simple error page
            return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Panel of Experts - Error</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 10px;
            color: #eee;
            background-color: #333;
        }
        .error {
            color: #ff6b6b;
            background-color: #440000;
            padding: 12px;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>Panel of Experts</h1>
    <div class="error">
        <h3>Error generating content</h3>
        <p>${error && typeof error === 'object' && 'message' in error ? error.message : 'An unknown error occurred while generating the panel content'}</p>
        <p>Try restarting the Panel of Experts or check the extension logs.</p>
        <button id="create-session-button" style="margin-top: 15px; padding: 8px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Create New Session
        </button>
    </div>
    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            const createSessionButton = document.getElementById('create-session-button');
            
            // Notify that the view is ready
            vscode.postMessage({
                type: 'viewReady'
            });
            
            if (createSessionButton) {
                createSessionButton.addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'createSession'
                    });
                });
            }
        })();
    </script>
</body>
</html>`;
        }
    }

    /**
     * Get available providers and models from configuration
     */
    private getAvailableProviders(): { providers: string[] } {
        const config = vscode.workspace.getConfiguration('poe');
        const providers: string[] = [];
        
        // Check which providers have API keys configured (using keys from package.json)
        if (config.get('openaiApiKey')) {
            providers.push('openai');
        }
        if (config.get('anthropicApiKey')) {
            providers.push('anthropic');
        }
        if (config.get('geminiApiKey')) {
            providers.push('gemini');
        }
        
        // Ollama is always available if running locally
        providers.push('ollama');
        
        return { providers };
    }

    /**
     * Fetch available models from OpenAI API
     */
    private async fetchOpenAIModels(apiKey: string): Promise<string[]> {
        try {
            if (outputChannel) {
                outputChannel.appendLine('Making OpenAI models API call...');
            }
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                if (outputChannel) {
                    outputChannel.appendLine(`OpenAI API error: ${response.status} - ${errorText}`);
                }
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            const models = data.data
                .filter((model: { id: string }) => model.id.includes('gpt'))
                .map((model: { id: string }) => model.id)
                .sort();
            
            if (outputChannel) {
                outputChannel.appendLine(`OpenAI API response: ${models.length} GPT models found`);
            }
            
            return models;
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine(`Error fetching OpenAI models: ${error}`);
            }
            // No fallback - return empty array if API call fails
            return [];
        }
    }

    /**
     * Fetch available models from Anthropic API
     */
    private async fetchAnthropicModels(apiKey: string): Promise<string[]> {
        try {
            if (outputChannel) {
                outputChannel.appendLine('Fetching Anthropic models from API...');
            }
            
            const response = await fetch('https://api.anthropic.com/v1/models', {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                if (outputChannel) {
                    outputChannel.appendLine(`Anthropic API error: ${response.status} - ${errorText}`);
                }
                throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            const models = data.data
                .map((model: { id: string }) => model.id)
                .sort();
            
            if (outputChannel) {
                outputChannel.appendLine(`Anthropic API response: ${models.length} models found`);
            }
            
            return models;
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine(`Error fetching Anthropic models: ${error}`);
            }
            // No fallback - return empty array if API call fails
            return [];
        }
    }

    /**
     * Fetch available models from Ollama server
     */
    private async fetchOllamaModels(baseUrl: string = 'http://localhost:11434'): Promise<string[]> {
        try {
            if (outputChannel) {
                outputChannel.appendLine(`Making Ollama API call to ${baseUrl}/api/tags...`);
            }
            const response = await fetch(`${baseUrl}/api/tags`);
            
            if (!response.ok) {
                const errorText = await response.text();
                if (outputChannel) {
                    outputChannel.appendLine(`Ollama API error: ${response.status} - ${errorText}`);
                }
                throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            const models = data.models
                .map((model: { name: string }) => model.name)
                .sort();
            
            if (outputChannel) {
                outputChannel.appendLine(`Ollama API response: ${models.length} models found`);
            }
            
            return models;
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine(`Error fetching Ollama models: ${error}`);
            }
            // No fallback - return empty array if API call fails
            return [];
        }
    }

    /**
     * Get all available models for all configured providers
     */
    private async getAvailableModels(): Promise<Record<string, string[]>> {
        const config = vscode.workspace.getConfiguration('poe');
        const models: Record<string, string[]> = {};
        
        if (outputChannel) {
            outputChannel.appendLine('=== Starting model fetching ===');
        }
        
        // Fetch OpenAI models
        const openaiKey = config.get('openaiApiKey') as string;
        if (openaiKey) {
            if (outputChannel) {
                outputChannel.appendLine('Found OpenAI API key, fetching models...');
            }
            models['openai'] = await this.fetchOpenAIModels(openaiKey);
            if (outputChannel) {
                outputChannel.appendLine(`OpenAI models: ${models['openai'].length} found`);
            }
        } else {
            if (outputChannel) {
                outputChannel.appendLine('No OpenAI API key found');
            }
        }
        
        // Fetch Anthropic models
        const anthropicKey = config.get('anthropicApiKey') as string;
        if (anthropicKey) {
            if (outputChannel) {
                outputChannel.appendLine('Found Anthropic API key, fetching models...');
            }
            models['anthropic'] = await this.fetchAnthropicModels(anthropicKey);
            if (outputChannel) {
                outputChannel.appendLine(`Anthropic models: ${models['anthropic'].length} found`);
            }
        } else {
            if (outputChannel) {
                outputChannel.appendLine('No Anthropic API key found');
            }
        }
        
        // Gemini models (API doesn't provide model list, use configurable list)
        const geminiKey = config.get('geminiApiKey') as string;
        if (geminiKey) {
            if (outputChannel) {
                outputChannel.appendLine('Found Gemini API key, getting models from config...');
            }
            const geminiModels = config.get('geminiModels') as string[] || [
                'gemini-1.5-pro',
                'gemini-1.5-flash',
                'gemini-1.0-pro',
                'gemini-1.0-pro-vision'
            ];
            models['gemini'] = geminiModels;
            if (outputChannel) {
                outputChannel.appendLine(`Gemini models: ${models['gemini'].length} found`);
            }
        } else {
            if (outputChannel) {
                outputChannel.appendLine('No Gemini API key found');
            }
        }
        
        // Fetch Ollama models
        const ollamaBaseUrl = config.get('ollamaBaseUrl') as string || 'http://localhost:11434';
        if (outputChannel) {
            outputChannel.appendLine(`Fetching Ollama models from ${ollamaBaseUrl}...`);
        }
        models['ollama'] = await this.fetchOllamaModels(ollamaBaseUrl);
        if (outputChannel) {
            outputChannel.appendLine(`Ollama models: ${models['ollama'].length} found`);
        }
        
        if (outputChannel) {
            outputChannel.appendLine('=== Model fetching complete ===');
            outputChannel.appendLine(`Total providers with models: ${Object.keys(models).length}`);
            for (const [provider, modelList] of Object.entries(models)) {
                outputChannel.appendLine(`  ${provider}: ${modelList.length} models`);
            }
        }
        
        return models;
    }

    /**
     * Generate panel creation form HTML with provider/model validation
     */
    private getPanelCreationFormHtml(): string {
        const { providers } = this.getAvailableProviders();
        
        if (providers.length === 0) {
            return `
            <div class="panel-creation-modal" style="background:#222;padding:20px;border-radius:8px;margin-bottom:20px;">
                <h2>No Providers Configured</h2>
                <p>You need to configure at least one AI provider before creating a panel.</p>
                <p>Please go to Settings → Extensions → Panel of Experts and configure your API keys.</p>
                <button type="button" id="cancel-panel-btn">Cancel</button>
            </div>`;
        }
        
        const providerOptions = providers.map(p => `<option value="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('');
        
        return `
        <div class="panel-creation-modal" style="background:#222;padding:20px;border-radius:8px;margin-bottom:20px;">
            <h2>Create a New Panel of Experts</h2>
            <p style="color:#ffa500;margin-bottom:16px;">
                <strong>Note:</strong> Models will be loaded dynamically from your configured providers. 
                If no models appear, check your API keys and network connection.
            </p>
            <form id="panel-creation-form">
                <label>Panel Name:<br><input type="text" id="panel-name" required style="width:100%;margin-bottom:8px;"></label><br>
                <label>Description:<br><input type="text" id="panel-description" style="width:100%;margin-bottom:8px;"></label><br>
                <div id="experts-section">
                    <h3>Experts</h3>
                    <div id="experts-list"></div>
                    <button type="button" id="add-expert-btn">Add Expert</button>
                </div>
                <h3>Moderator</h3>
                <label>Name:<br><input type="text" id="moderator-name" required style="width:100%;margin-bottom:8px;"></label><br>
                <label>Provider:<br><select id="moderator-provider" required style="width:100%;margin-bottom:8px;"><option value="">Select Provider</option>${providerOptions}</select></label><br>
                <label>Model:<br><select id="moderator-model" required style="width:100%;margin-bottom:8px;"><option value="">Select Model</option></select></label><br>
                <label>System Prompt:<br><textarea id="moderator-system-prompt" style="width:100%;margin-bottom:8px;"></textarea></label><br>
                <button type="submit" id="save-panel-btn">Save Panel</button>
                <button type="button" id="cancel-panel-btn">Cancel</button>
            </form>
        </div>`;
    }
} 