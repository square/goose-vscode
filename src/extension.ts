import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

let gooseTerminal: vscode.Terminal | undefined;
const terminalName = '🪿 goose chat 🪿';

export function activate(context: vscode.ExtensionContext) {

    // Check if goose CLI is installed
    const config = vscode.workspace.getConfiguration('goose');
    let defaultCommand = config.get('defaultCommand', "goose session start");    
    try {
        execSync('goose version');
    } catch (error) {
        try {
            execSync('sq goose version');
            defaultCommand = 'sq goose session start'                        
        } catch (error) {
            vscode.window.showWarningMessage('If goose isn\'t working, please check the goose command line tool is installed and working.');
        }
    }
    
    vscode.window.showInformationMessage('goose agent starting, this may take a minute.. ⏰');    

    let getTerminal = () => {
        if (!gooseTerminal || gooseTerminal.exitStatus !== undefined) {
           gooseTerminal = vscode.window.createTerminal({
                name: terminalName,            
                location: { viewColumn: vscode.ViewColumn.Beside },
                message: 'Loading Goose Session...', // Add a message to make it clear what terminal is for                
            });            
            gooseTerminal.sendText(defaultCommand);
        }

        console.log('Goose terminal created:', gooseTerminal.name);
        gooseTerminal.show(); // Delayed terminal show
        
        return gooseTerminal

    }

    let openTerminalDisposable = vscode.commands.registerCommand('extension.openGooseTerminal', () => {
        getTerminal();
    });
    context.subscriptions.push(openTerminalDisposable);
        
        // Automatically open the terminal when the extension activates
    let disposable = vscode.commands.registerCommand('extension.openSidepanel', () => {
        SidePanel.createOrShow(context.extensionPath);
    });
    context.subscriptions.push(disposable);

    class SidePanel {
        public static currentPanel: SidePanel | undefined;
        private readonly _panel: vscode.WebviewPanel;
        private readonly _extensionPath: string;
        private _disposables: vscode.Disposable[] = [];

        public static createOrShow(extensionPath: string) {
            if (SidePanel.currentPanel) {
                SidePanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
                return;
            }

            const panel = vscode.window.createWebviewPanel(
                'sidepanel',
                'Markdown Sidepanel',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))]
                }
            );

            SidePanel.currentPanel = new SidePanel(panel, extensionPath);
        }

        private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
            this._panel = panel;
            this._extensionPath = extensionPath;

            this._update();

            this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
            this._panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'submitInput':
                            vscode.window.showInformationMessage(`User Input: ${message.text}`);
                            return;
                    }
                },
                null,
                this._disposables
            );
        }

        public dispose() {
            SidePanel.currentPanel = undefined;

            this._panel.dispose();

            while (this._disposables.length) {
                const disposable = this._disposables.pop();
                if (disposable) {
                    disposable.dispose();
                }
            }
        }

        private _update() {
            this._panel.webview.html = this._getHtmlForWebview();
        }

        private _getHtmlForWebview() {
            const markdownContent = `
# Welcome to the Sidepanel

This is a static markdown content displayed in the webview.

- Item 1
- Item 2
- Item 3

`;

            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sidepanel</title>
    <style>
        body { font-family: sans-serif; padding: 10px; }
        #inputContainer { margin-top: 20px; }
        #userInput { width: 100%; padding: 5px; }
    </style>
</head>
<body>
    <div id="markdownContent">
        ${markdownContent}
    </div>
    <div id="inputContainer">
        <input type="text" id="userInput" placeholder="Enter your input here" />
    </div>
    <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('userInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const text = e.target.value;
                vscode.postMessage({ command: 'submitInput', text: text });
                e.target.value = '';
            }
        });
    </script>
</body>
</html>`;
        }
    }

    vscode.commands.executeCommand('extension.openGooseTerminal');
    vscode.commands.executeCommand('extension.openSidepanel');
    
    
    let sendToGooseDisposable = vscode.commands.registerCommand('extension.sendToGoose', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        // Get the selected text
        const selection = editor.selection;

        // Get the file path and selection range
        const filePath = editor.document.uri.fsPath;
        const startLine = selection.start.line + 1; // Line numbers are 1-based for better readability
        const endLine = selection.end.line + 1;

        // Prompt the user for a question
        const question = await vscode.window.showInputBox({ prompt: 'Ask goose something:' });
        if (!question) {
            return;
        }
        
        const selectedText = editor.document.getText(selection);
        const hasSelectedText = selectedText.trim().length > 0;
        let textToAskGoose = question;
        if (hasSelectedText) {
            // There is some selected test
            textToAskGoose = `Looking at file: ${filePath} regarding lines: ${startLine} to ${endLine}` +
                             ` please load fhe file, answer this question: [${question}].` + 
                             ` Note: If editing is required, keep edits around these lines and don't delete or modify unrelated code.`
        } else {
            // cursor is just position in file
            textToAskGoose = `Looking at file: ${filePath} around line: ${startLine}, ` +
                            ` Please answer the query: [${question}] `                            

        }
        editor.document.save();
        getTerminal().sendText(textToAskGoose);
    });
    
    context.subscriptions.push(sendToGooseDisposable);

    // Register code lens provider
    vscode.languages.registerCodeLensProvider('*', {
        provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return [];
            }
            const codeLens = new vscode.CodeLens(editor.selection, {
                command: 'extension.sendToGoose',
                title: '🪿 Ask Goose 🪿'
            });
            return [codeLens];
        }
    });

    // Completion suggestion: ask Goose to finish it
    vscode.languages.registerCodeActionsProvider('*', {
        provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken) {            
            const codeAction = new vscode.CodeAction('Ask Goose to fix it', vscode.CodeActionKind.QuickFix);
            codeAction.command = { command: 'extension.askGooseToFinishIt', title: 'Ask Goose to fix it' };
            return [codeAction];
        }
    });

    
    // Register inline completion provider
    vscode.languages.registerInlineCompletionItemProvider('*', {
        provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const completionItem = new vscode.InlineCompletionItem('Ask Goose to complete this code');
            completionItem.insertText = '';
            completionItem.command = { command: 'extension.askGooseToFinishIt', title: 'Ask Goose to complete this code' };
            return [completionItem];
        }
    });

    // Register content completion extension
    vscode.languages.registerCompletionItemProvider('*', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            const completionItem = new vscode.CompletionItem('Ask Goose to finish this code', vscode.CompletionItemKind.Snippet);
            completionItem.insertText = '';
            completionItem.command = { command: 'extension.askGooseToFinishIt', title: 'Ask Goose to finish this code' };
            return [completionItem];
        }
    }, '.');
  


    const askGooseToFinishItCommand = vscode.commands.registerCommand('extension.askGooseToFinishIt', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const filePath = document.uri.fsPath;
        const startLine = selection.start.line + 1;

        document.save();

        getTerminal().sendText(`There is some unfinished code at line: ${startLine} in file: ${filePath}. ` + 
                                `Complete the code based on the context, from that line onwards. Do not delete content.`);
    });
    context.subscriptions.push(askGooseToFinishItCommand);

    const askGooseToFix = vscode.commands.registerCommand('extension.askGooseToFix', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const filePath = document.uri.fsPath;
        const startLine = selection.start.line + 1;

        document.save();

        getTerminal().sendText(`Can you look at the code on line: ${startLine} in file: ${filePath}. ` + 
                                `and fix any problems you see on this line and near it. Try not to delete content.`);        
    });
    context.subscriptions.push(askGooseToFix);    

}

