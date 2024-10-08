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
    vscode.commands.executeCommand('extension.openGooseTerminal');
    
    
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
            const codeAction = new vscode.CodeAction('Ask goose to fix it', vscode.CodeActionKind.QuickFix);
            codeAction.command = { command: 'extension.askGooseToFix', title: 'Ask goose to fix it' };
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

            const completionItem = new vscode.InlineCompletionItem('complete with goose');
            completionItem.insertText = '';
            completionItem.command = { command: 'extension.askGooseToFinishIt', title: 'complete with goose' };
            return [completionItem];
        }
    });

    // Register content completion extension
    vscode.languages.registerCompletionItemProvider('*', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            const completionItem = new vscode.CompletionItem('Ask Goose to finish this code', vscode.CompletionItemKind.Text);
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

