import * as vscode from 'vscode';
import { ConversationOrchestrator } from '../orchestration/ConversationOrchestrator';

/**
 * WebviewViewProvider for the Panel of Experts view
 */
export class PanelViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _orchestrator?: ConversationOrchestrator;

    constructor(private readonly _extensionUri: vscode.Uri) {
        console.log('PanelViewProvider constructor called');
    }

    /**
     * Set the active orchestrator
     */
    setOrchestrator(orchestrator: ConversationOrchestrator | undefined): void {
        console.log('PanelViewProvider.setOrchestrator called', orchestrator ? 'with orchestrator' : 'with undefined');
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
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('PanelViewProvider.resolveWebviewView called');
        this._view = webviewView;

        // Set options for the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Set initial HTML content
        this._updateView();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            console.log('Received message from webview:', message);
            // Handle message based on type
            if (message.type === 'sendMessage' && this._orchestrator) {
                this._orchestrator.addUserMessage(message.text);
            }
        });
        
        console.log('PanelViewProvider.resolveWebviewView completed');
    }

    /**
     * Update the webview content
     */
    private _updateView() {
        if (!this._view) {
            console.log('PanelViewProvider._updateView: No view available yet');
            return;
        }

        try {
            console.log('PanelViewProvider._updateView: Updating HTML content');
            // Create HTML content
            let html = this._getHtmlContent();
            this._view.webview.html = html;
            console.log('PanelViewProvider._updateView: HTML content set');
        } catch (error) {
            console.error('Error updating view:', error);
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
        console.log('PanelViewProvider._getHtmlContent: hasOrchestrator =', hasOrchestrator);
        
        const messages = hasOrchestrator && this._orchestrator ? this._orchestrator.getSession().messages || [] : [];
        console.log(`PanelViewProvider._getHtmlContent: Found ${messages.length} messages`);

        // Generate message HTML
        let messagesHtml = '';
        if (hasOrchestrator && messages.length > 0) {
            console.log('PanelViewProvider._getHtmlContent: Generating messages HTML');
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
            console.log('PanelViewProvider._getHtmlContent: Generating no-session HTML');
            messagesHtml = `<div class="no-session">
                <p>No active discussion session.</p>
                <p>Use the command palette to start a new panel discussion.</p>
                <p><code>Cmd+Shift+P</code> → "Start Panel of Experts Discussion"</p>
            </div>`;
        }

        console.log('PanelViewProvider._getHtmlContent: Completed generating HTML content');
        
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