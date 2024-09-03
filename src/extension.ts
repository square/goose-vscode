import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

let gooseTerminal: vscode.Terminal | undefined;
const terminalName = '🪿 goose chat 🪿';
const tempFilePath = path.join(os.tmpdir(), 'goose_open_files.txt');
const tempFilePathDirty = path.join(os.tmpdir(), 'goose_unsaved_files.txt');

export function activate(context: vscode.ExtensionContext) {

    // Check if goose CLI is installed
    try {
        execSync('goose');
    } catch (error) {
        const installUrl = 'https://github.com/square/goose-vscode';
        vscode.window.showErrorMessage('goose is required to be installed', { modal: true }, 'Install').then(selection => {
            if (selection === 'Install') {
                vscode.env.openExternal(vscode.Uri.parse(installUrl));
            }
        });
        return; // Exit activation if goose is not installed
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

    const config = vscode.workspace.getConfiguration('goose');
    const defaultCommand = config.get('defaultCommand', 'goose session resume');

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
        
        if (startLine != endLine) {     
            const selectedText = editor.document.getText(selection).replace(/\n/g, ' ');       
            gooseTerminal?.sendText(`Question ${question} regarding selected text: ${selectedText} (from lines ${startLine}-${endLine} in file ${filePath})`);
        } else {
            gooseTerminal?.sendText(question);
        }
        
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
