import * as vscode from 'vscode';
import { ConversationOrchestrator } from '../orchestration/ConversationOrchestrator';
import { ConversationSession } from '../types';

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

    constructor(private readonly _extensionUri: vscode.Uri) {
        if (outputChannel) {
            outputChannel.appendLine('PanelViewProvider constructor called');
        } else {
            console.log('PanelViewProvider constructor called');
        }
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
    resolveWebviewView(
        webviewView: vscode.WebviewView
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
            
            // Debug logging for webview
            if (outputChannel) {
                outputChannel.appendLine('Webview view HTML content set');
                if (this._orchestrator) {
                    outputChannel.appendLine('We have an orchestrator at view resolve time');
                } else {
                    outputChannel.appendLine('No orchestrator at view resolve time');
                }
                
                outputChannel.appendLine(`Sessions available: ${this._sessions.length}`);
            }

            // Listen for visibility changes
            webviewView.onDidChangeVisibility(() => {
                if (outputChannel) {
                    outputChannel.appendLine(`WebviewView visibility changed: ${webviewView.visible ? 'visible' : 'not visible'}`);
                }
                if (webviewView.visible) {
                    // Update view when it becomes visible
                    this._updateView();
                }
            });

            // Handle messages from the webview
            webviewView.webview.onDidReceiveMessage(message => {
                if (outputChannel) {
                    outputChannel.appendLine('Received message from webview: ' + JSON.stringify(message));
                } else {
                    console.log('Received message from webview:', message);
                }
                // Handle message based on type
                if (message.type === 'sendMessage' && this._orchestrator) {
                    this._orchestrator.addUserMessage(message.text);
                } else if (message.type === 'switchSession') {
                    this._handleSessionSwitch(message.sessionId);
                } else if (message.type === 'createSession') {
                    this._handleCreateSession();
                } else if (message.type === 'viewReady') {
                    // The webview is fully loaded and ready
                    outputChannel?.appendLine('Webview reported it is ready');
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
            if (outputChannel) {
                outputChannel.appendLine('PanelViewProvider._updateView: Updating HTML content');
            } else {
                console.log('PanelViewProvider._updateView: Updating HTML content');
            }
            // Create HTML content
            const html = this._getHtmlContent();
            this._view.webview.html = html;
            if (outputChannel) {
                outputChannel.appendLine('PanelViewProvider._updateView: HTML content set');
            } else {
                console.log('PanelViewProvider._updateView: HTML content set');
            }
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
            if (outputChannel) {
                outputChannel.appendLine('PanelViewProvider._getHtmlContent: hasOrchestrator = ' + hasOrchestrator);
            } else {
                console.log('PanelViewProvider._getHtmlContent: hasOrchestrator =', hasOrchestrator);
            }
            
            const currentSession = hasOrchestrator && this._orchestrator ? this._orchestrator.getSession() : undefined;
            const messages = currentSession?.messages || [];
            if (outputChannel) {
                outputChannel.appendLine(`PanelViewProvider._getHtmlContent: Found ${messages.length} messages in current session`);
            } else {
                console.log(`PanelViewProvider._getHtmlContent: Found ${messages.length} messages`);
            }

            // Get all available sessions
            const allSessions: ConversationSession[] = this._sessions;
            
            // Log session count
            if (outputChannel) {
                outputChannel.appendLine(`PanelViewProvider._getHtmlContent: Found ${allSessions.length} available sessions`);
            } else {
                console.log(`PanelViewProvider._getHtmlContent: Found ${allSessions.length} available sessions`);
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
                if (outputChannel) {
                    outputChannel.appendLine('PanelViewProvider._getHtmlContent: Generating messages HTML');
                } else {
                    console.log('PanelViewProvider._getHtmlContent: Generating messages HTML');
                }
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

            if (outputChannel) {
                outputChannel.appendLine('PanelViewProvider._getHtmlContent: Completed generating HTML content');
            } else {
                console.log('PanelViewProvider._getHtmlContent: Completed generating HTML content');
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
            #create-session-button {
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
        
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                const messageInput = document.getElementById('message-input');
                const sendButton = document.getElementById('send-button');
                const sessionSelect = document.getElementById('session-select');
                const createSessionButton = document.getElementById('create-session-button');
                
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
} 