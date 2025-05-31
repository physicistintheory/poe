import * as vscode from 'vscode';
import { ConversationOrchestrator } from '../orchestration/ConversationOrchestrator';
import { SessionsTreeDataProvider } from './SessionsTreeDataProvider';
import { ConversationSession } from '../types';

// Reference to the shared output channel
let outputChannel: vscode.OutputChannel;
// Reference to the sessions provider for accessing sessions
let sessionsProvider: SessionsTreeDataProvider | undefined;

/**
 * Set the output channel for logging
 */
export function setOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel;
}

/**
 * Set the sessions provider reference
 */
export function setSessionsProvider(provider: SessionsTreeDataProvider) {
    sessionsProvider = provider;
}

/**
 * WebviewViewProvider for the Panel of Experts view
 */
export class PanelViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _orchestrator?: ConversationOrchestrator;

    constructor(private readonly _extensionUri: vscode.Uri) {
        if (outputChannel) {
            outputChannel.appendLine('PanelViewProvider constructor called');
        } else {
            console.log('PanelViewProvider constructor called');
        }
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
        }
        
        // Try to update the view immediately
        this._updateView();
        
        // If the view isn't available yet, try again after a short delay
        if (!this._view) {
            if (outputChannel) {
                outputChannel.appendLine('View not available, will retry update in 1 second');
            }
            setTimeout(() => {
                if (outputChannel) {
                    outputChannel.appendLine('Retrying view update...');
                }
                this._updateView();
                
                // If still not available, try once more with a longer delay
                if (!this._view) {
                    if (outputChannel) {
                        outputChannel.appendLine('View still not available, will retry update in 3 seconds');
                    }
                    setTimeout(() => {
                        if (outputChannel) {
                            outputChannel.appendLine('Final retry for view update...');
                        }
                        this._updateView();
                    }, 3000);
                }
            }, 1000);
        }
    }

    /**
     * Required method to resolve the webview view
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _context: vscode.WebviewViewResolveContext,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken
    ) {
        if (outputChannel) {
            outputChannel.appendLine('PanelViewProvider.resolveWebviewView called');
            outputChannel.appendLine(`WebviewView state: ${webviewView.visible ? 'visible' : 'not visible'}`);
        } else {
            console.log('PanelViewProvider.resolveWebviewView called');
        }
        this._view = webviewView;

        // Set options for the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Set initial HTML content
        this._updateView();

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
            }
        });
        
        if (outputChannel) {
            outputChannel.appendLine('PanelViewProvider.resolveWebviewView completed');
        } else {
            console.log('PanelViewProvider.resolveWebviewView completed');
        }
    }

    /**
     * Handle session switching
     */
    private _handleSessionSwitch(sessionId: string): void {
        if (!sessionsProvider) {
            if (outputChannel) {
                outputChannel.appendLine('Cannot switch session: sessions provider not available');
            }
            return;
        }

        // Find the session in the sessions provider
        const session = sessionsProvider['sessions'].find(s => s.id === sessionId);
        if (!session) {
            if (outputChannel) {
                outputChannel.appendLine(`Session with ID ${sessionId} not found`);
            }
            return;
        }

        // Notify external components about session switch
        vscode.commands.executeCommand('poe.switchSession', session);
        
        // Update the view
        this._updateView();
    }

    /**
     * Update the webview content
     */
    private _updateView() {
        if (!this._view) {
            if (outputChannel) {
                outputChannel.appendLine('PanelViewProvider._updateView: No view available yet');
            } else {
                console.log('PanelViewProvider._updateView: No view available yet');
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
    private _getErrorHtml(error: any): string {
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
        <p>${error?.message || 'An unknown error occurred'}</p>
        <p>Try restarting the Panel of Experts or check the extension logs.</p>
    </div>
</body>
</html>`;
    }

    /**
     * Generate HTML content for the webview
     */
    private _getHtmlContent(): string {
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
            outputChannel.appendLine(`PanelViewProvider._getHtmlContent: Found ${messages.length} messages`);
        } else {
            console.log(`PanelViewProvider._getHtmlContent: Found ${messages.length} messages`);
        }

        // Get all available sessions from the sessions provider
        const allSessions: ConversationSession[] = sessionsProvider ? sessionsProvider['sessions'] : [];
        
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
            width: 100%;
            padding: 6px;
            background-color: #444;
            color: #eee;
            border: 1px solid #555;
            border-radius: 4px;
            margin-top: 5px;
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
        })();
    </script>
</body>
</html>`;
    }
} 