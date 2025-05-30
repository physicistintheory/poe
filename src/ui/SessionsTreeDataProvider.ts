import * as vscode from 'vscode';
import { ConversationSession } from '../types';

/**
 * Represents a session item in the tree view
 */
export class SessionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly session: ConversationSession,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(session.title, collapsibleState);
        this.tooltip = `${session.title}\nCreated: ${new Date(session.created).toLocaleString()}`;
        this.description = session.goal || 'No goal set';
        this.contextValue = 'session';
        
        // Add a timestamp as description
        const dateStr = new Date(session.updated).toLocaleDateString();
        this.description = `${dateStr} - ${this.description}`;
        
        // Use a chat icon
        this.iconPath = new vscode.ThemeIcon('comment-discussion');
    }
}

/**
 * Tree data provider for expert sessions
 */
export class SessionsTreeDataProvider implements vscode.TreeDataProvider<SessionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SessionTreeItem | undefined> = new vscode.EventEmitter<SessionTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<SessionTreeItem | undefined> = this._onDidChangeTreeData.event;
    
    private sessions: ConversationSession[] = [];
    
    constructor() {
        // Initialize with empty sessions list
    }
    
    /**
     * Update the list of sessions and refresh the view
     */
    updateSessions(sessions: ConversationSession[]): void {
        this.sessions = [...sessions];
        this._onDidChangeTreeData.fire(undefined);
    }
    
    /**
     * Add a new session to the list
     */
    addSession(session: ConversationSession): void {
        this.sessions.push(session);
        this._onDidChangeTreeData.fire(undefined);
    }
    
    /**
     * Remove a session from the list
     */
    removeSession(sessionId: string): void {
        this.sessions = this.sessions.filter(s => s.id !== sessionId);
        this._onDidChangeTreeData.fire(undefined);
    }
    
    /**
     * Get the tree item representation of the element
     */
    getTreeItem(element: SessionTreeItem): vscode.TreeItem {
        return element;
    }
    
    /**
     * Get the children of the element
     */
    getChildren(element?: SessionTreeItem): Thenable<SessionTreeItem[]> {
        if (element) {
            // No children for session items
            return Promise.resolve([]);
        } else {
            // Root: return all sessions
            return Promise.resolve(
                this.sessions.map(
                    session => new SessionTreeItem(
                        session, 
                        vscode.TreeItemCollapsibleState.None
                    )
                )
            );
        }
    }
} 