import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let gooseTerminal: vscode.Terminal | undefined;
const terminalName = '🪿 goose agent 🪿';
const tempFilePath = path.join(os.tmpdir(), 'goose_open_files.txt');
const tempFilePathDirty = path.join(os.tmpdir(), 'goose_unsaved_files.txt');


export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('goose agent activated');

    const updateOpenFiles = () => {
        const openTextDocuments = vscode.workspace.textDocuments.filter(doc => !(doc.fileName.startsWith('git') || doc.fileName.endsWith('.git')));
        const openFiles = openTextDocuments.map(doc => doc.fileName).join('\n');
        const unsavedChanges = vscode.workspace.textDocuments.filter(doc => doc.isDirty).join('\n');
        fs.writeFileSync(tempFilePath, openFiles, 'utf-8');
        fs.writeFileSync(tempFilePathDirty, unsavedChanges, 'utf-8');
    };

    const initialPrompt = `Please take a look in the current directory to orient yourself for the type of project this is. You are operating inside VSCode, if you need to know what files are open, please look in ${tempFilePath}, which will be updated with whatever the user has open in VSCode, also ${tempFilePathDirty} has a list of files which are not saved, so check with the user if you need to edit one of those files. Provide a brief summary of things with a welcome message, but be brief. No need to open each file yet.`;

    // Subscribe to events to update the temp file when open files change
    vscode.workspace.onDidOpenTextDocument(updateOpenFiles, null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(updateOpenFiles, null, context.subscriptions);

    let openTerminalDisposable = vscode.commands.registerCommand('extension.openGooseTerminal', () => {
            gooseTerminal = vscode.window.createTerminal({
                name: terminalName,
                location: { viewColumn: vscode.ViewColumn.Beside }
            });
            gooseTerminal.sendText('goose session start');

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
}

export function deactivate() {
    if (gooseTerminal) {
        gooseTerminal.sendText('exit');
        gooseTerminal.dispose();
    }
}
