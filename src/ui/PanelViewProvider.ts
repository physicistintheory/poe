import * as vscode from 'vscode';
import { ConversationOrchestrator } from '../orchestration/ConversationOrchestrator';

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
    private _onViewReady = new vscode.EventEmitter<void>();

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
        
        this._updateView();
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
                }
            });
            
            if (outputChannel) {
                outputChannel.appendLine('PanelViewProvider.resolveWebviewView completed');
            } else {
                console.log('PanelViewProvider.resolveWebviewView completed');
            }
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine('Error updating view: ' + error);
            } else {
                console.error('Error updating view:', error);
            }
            // Provide a fallback UI in case of error
            if (this._view) {
                this._view.webview.html = this._getErrorHtml(error);
            }
        }
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
        
        const messages = hasOrchestrator && this._orchestrator ? this._orchestrator.getSession().messages || [] : [];
        if (outputChannel) {
            outputChannel.appendLine(`PanelViewProvider._getHtmlContent: Found ${messages.length} messages`);
        } else {
            console.log(`PanelViewProvider._getHtmlContent: Found ${messages.length} messages`);
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
    </style>
</head>
<body>
    <h1>Panel of Experts</h1>
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
        })();
    </script>
</body>
</html>`;
    }
} 