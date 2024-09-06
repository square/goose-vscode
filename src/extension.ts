import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

let gooseTerminal: vscode.Terminal | undefined;
const terminalName = '🪿 goose chat 🪿';
const tempFilePath = path.join(os.tmpdir(), 'goose_open_files.txt');
const tempFilePathDirty = path.join(os.tmpdir(), 'goose_unsaved_files.txt');
const FALLBACK_COMMAND = "goose session start"

export function activate(context: vscode.ExtensionContext) {
    

    // Check if goose CLI is installed
    const config = vscode.workspace.getConfiguration('goose');
    let defaultCommand = config.get('defaultCommand', FALLBACK_COMMAND);
    
    try {
        execSync('goose');
    } catch (error) {
        try {
            execSync('sq');
            if (defaultCommand == FALLBACK_COMMAND) {
                defaultCommand = 'sq goose session start'
            }            
        } catch (error) {
            vscode.window.showWarningMessage('If goose isn\'t working, please check the goose command line tool is installed and working.');
        }
    }
    
    vscode.window.showInformationMessage('goose agent starting, this may take a minute.. ⏰');


    const updateOpenFiles = () => {
        const openTextDocuments = vscode.workspace.textDocuments.filter(doc => !(doc.fileName.startsWith('git') || doc.fileName.endsWith('.git')));
        const openFiles = openTextDocuments.map(doc => doc.fileName).join('\n');
        const unsavedChanges = vscode.workspace.textDocuments.filter(doc => doc.isDirty).join('\n');
        fs.writeFileSync(tempFilePath, openFiles, 'utf-8');
        fs.writeFileSync(tempFilePathDirty, unsavedChanges, 'utf-8');
    };

    const initialPrompt = `Starting up in a new context: you are now running inside vs code, please list files/dirs and look around for directories which may be source code, if there is a .goosehint file read it, can also look at README file for hints on how to navigate the project in this dir. Following is a list of files currently open being edited (updated dynamically you can read when needed): ${tempFilePath} which may be relevant, and following is a list of files which have unsaved changes (be careful to not over write): ${tempFilePathDirty}. Present a short welcome messsage when ready for instruction.`;

    // Subscribe to events to update the temp file when open files change
    vscode.workspace.onDidOpenTextDocument(updateOpenFiles, null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(updateOpenFiles, null, context.subscriptions);

    
    

    let openTerminalDisposable = vscode.commands.registerCommand('extension.openGooseTerminal', () => {
        gooseTerminal = vscode.window.createTerminal({
            name: terminalName,
            location: { viewColumn: vscode.ViewColumn.Beside }
        });
        gooseTerminal.sendText(defaultCommand);

        setTimeout(() => {
            gooseTerminal?.sendText('\n');

            // Initial update of open files
            updateOpenFiles();
            gooseTerminal?.sendText(initialPrompt);  
        }, 4000);
        
        gooseTerminal.show();
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
            const flattenedText = selectedText.replace(/\n/g, ' ');
            textToAskGoose = `Please look around selected text "${flattenedText}"` + 
                             `from lines ${startLine}-${endLine} in file ${filePath}` +
                             `and answer this question: ${question}:`
        }
        gooseTerminal?.sendText(textToAskGoose);
        gooseTerminal?.show();
    });
    
    context.subscriptions.push(sendToGooseDisposable);

    // Completion suggestion: ask Goose to finish it
    vscode.languages.registerCodeActionsProvider('*', {
        provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken) {            
            const codeAction = new vscode.CodeAction('Ask Goose to finish it', vscode.CodeActionKind.QuickFix);
            codeAction.command = { command: 'extension.askGooseToFinishIt', title: 'Ask Goose to finish it' };
            return [codeAction];
        }
    });

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
        

        gooseTerminal?.sendText(`There is some unfinished code around ${startLine} in file ${filePath}, can you please try to complete it as best makes sense.`);
        gooseTerminal?.show();
    });
    context.subscriptions.push(askGooseToFinishItCommand);
}

export function deactivate() {
    if (gooseTerminal) {
        gooseTerminal.sendText('exit');
        gooseTerminal.dispose();
    }
}
