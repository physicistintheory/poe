export const workspace = {
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn()
    })
};

export const window = {
    createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        show: jest.fn()
    })
};

export const StatusBarAlignment = {
    Left: 1,
    Right: 2
};

export const commands = {
    registerCommand: jest.fn()
};

export const ViewColumn = {
    One: 1,
    Two: 2,
    Three: 3
};

export const Uri = {
    file: jest.fn()
};

export const Range = jest.fn();

export const Position = jest.fn();

export const Selection = jest.fn();

export const TextEditorRevealType = {
    InCenter: 1
};

// Add TreeItem and TreeItemCollapsibleState mocks
export class TreeItem {
    constructor() {}
}

export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
}; 