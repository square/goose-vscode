import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

let gooseTerminal: vscode.Terminal | undefined;
const terminalName = '\u2728 goose chat \u2728';

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
    
    

    let getTerminal = () => {
        if (!gooseTerminal || gooseTerminal.exitStatus !== undefined) {
           vscode.window.showInformationMessage('goose agent starting, this may take a minute.. ⏰');    
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

    let openGooseTerminal = vscode.commands.registerCommand('extension.openGoose', () => {
        getTerminal();
    });
    context.subscriptions.push(openGooseTerminal);

    let openTerminalDisposable = vscode.commands.registerCommand('extension.openGooseTerminal', () => {
        getTerminal();
    });
    context.subscriptions.push(openTerminalDisposable);
        
    // Automatically open the terminal when the extension activates
    //vscode.commands.executeCommand('extension.openGooseTerminal');
    
    
    function createTempFileWithLines(selectedText: string, startLine: number): string {
    const selectedLines = selectedText.split('\n').map((line, index) => `${startLine + index}: ${line}`).join('\n');
    const tempDir = os.tmpdir();
    const tempFileName = path.join(tempDir, `goose_context_${Date.now()}.txt`);
    fs.writeFileSync(tempFileName, selectedLines);
    return tempFileName;
}

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
            // There is some selected text
            const tempFileName = createTempFileWithLines(selectedText, startLine);
            textToAskGoose = `Looking at file: ${filePath} with context: ${tempFileName}.` +
                             ` please load the file, answer this question: [${question}].` +
                             ` Note: If editing is required, keep edits around these lines and don't delete or modify unrelated code.`
        } else {
            // cursor is just position in file
            const cursorLine = editor.selection.active.line + 1;
            textToAskGoose = `Looking at file: ${filePath}, you are on line ${cursorLine}. ` +
                             `Please answer the query: [${question}]`                            

        }
        editor.document.save();
        getTerminal().sendText(textToAskGoose);

        // Check config for opening diff editor after Goose edits
        const openDiffAfterEdit = config.get('openDiffEditorAfterGooseEdits', false);
        if (openDiffAfterEdit) {
            // Watch for changes in the active text editor
            const watcher = vscode.workspace.createFileSystemWatcher(filePath);
            watcher.onDidChange(() => {
                vscode.commands.executeCommand('workbench.view.scm');
                watcher.dispose(); // Stop watching after opening SCM view
            });
        }
    });
    
    context.subscriptions.push(sendToGooseDisposable);






    // Completion suggestion: ask Goose to finish it
    vscode.languages.registerCodeActionsProvider('*', {
        provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken) {            
            const codeAction = new vscode.CodeAction('Ask goose to fix it', vscode.CodeActionKind.QuickFix);
            codeAction.command = { command: 'extension.askGooseToFix', title: 'Ask goose to fix it' };
            return [codeAction];
        }
    });

    // Completion suggestion: ask goose (general)
    vscode.languages.registerCodeActionsProvider('*', {
        provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken) {            
            const codeAction = new vscode.CodeAction('Ask goose', vscode.CodeActionKind.QuickFix);
            codeAction.command = { command: 'extension.sendToGoose', title: 'Ask goose' };
            return [codeAction];
        }
    });
    


    const askGooseToFix = vscode.commands.registerCommand('extension.askGooseToFix', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const filePath = document.uri.fsPath;
        const startLine = selection.start.line + 1;

        const selectedText = document.getText(selection);
        const tempFileName = createTempFileWithLines(selectedText, startLine);
        document.save();

        getTerminal().sendText(`Can you look at the code in file: ${filePath} with context: ${tempFileName}. ` +
                                `and fix any problems you see around it. Try not to delete content.`);        
    });
    context.subscriptions.push(askGooseToFix);    

}


