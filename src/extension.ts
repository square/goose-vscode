import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

let gooseTerminal: vscode.Terminal | undefined;
const terminalName = '\u2728 goose chat \u2728';

export function activate(context: vscode.ExtensionContext) {

    // Always use "goose session"
    // If goose is not found, create a new terminal that installs goose.
    let defaultCommand = "goose session";

    // Check if goose is installed. If cannot locate goose, we open a fresh terminal to install.
    try {
        execSync('which goose');
        console.log("Goose is installed. Will run 'goose session'.");
    } catch (e) {
        console.log("No goose found, starting installation terminal...");
        const installTerm = vscode.window.createTerminal({
            name: "installing goose"
        });
        installTerm.sendText("curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash");
        installTerm.show();
    }

    function getTerminal(): vscode.Terminal {
        if (!gooseTerminal || gooseTerminal.exitStatus !== undefined) {
            vscode.window.showInformationMessage('goose agent starting, this may take a minute.. ⏰');
            gooseTerminal = vscode.window.createTerminal({
                name: terminalName,
                message: 'Loading Goose Session...',
            });
            gooseTerminal.sendText(defaultCommand);
        }
        gooseTerminal.show();
        return gooseTerminal;
    }

    let openGooseTerminal = vscode.commands.registerCommand('extension.openGooseTerminal', () => {
        getTerminal();
    });
    context.subscriptions.push(openGooseTerminal);

    let openGoosePanel = vscode.commands.registerCommand('extension.openGoose', () => {
        getTerminal();
    });
    context.subscriptions.push(openGoosePanel);

    function createTempFileWithLines(selectedText: string, startLine: number): string {
        const selectedLines = selectedText
            .split('\n')
            .map((line, index) => `${startLine + index}: ${line}`)
            .join('\n');
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

        const selection = editor.selection;
        const filePath = editor.document.uri.fsPath;
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;

        const question = await vscode.window.showInputBox({ prompt: 'Ask goose something:' });
        if (!question) {
            return;
        }

        const selectedText = editor.document.getText(selection);
        const hasSelectedText = selectedText.trim().length > 0;
        let textToAskGoose = question;
        if (hasSelectedText) {
            const tempFileName = createTempFileWithLines(selectedText, startLine);
            textToAskGoose = `Looking at file: ${filePath} with context: ${tempFileName}. please load the file, answer this question: [${question}]. Note: If editing is required, keep edits around these lines and don't delete or modify unrelated code.`;
        } else {
            const cursorLine = editor.selection.active.line + 1;
            textToAskGoose = `Looking at file: ${filePath}, you are on line ${cursorLine}. Please answer the query: [${question}]`;
        }

        editor.document.save();
        getTerminal().sendText(textToAskGoose);

        const openDiffAfterEdit = vscode.workspace.getConfiguration('goose').get('openDiffEditorAfterGooseEdits', false);
        if (openDiffAfterEdit) {
            const watcher = vscode.workspace.createFileSystemWatcher(filePath);
            watcher.onDidChange(() => {
                vscode.commands.executeCommand('workbench.view.scm');
                watcher.dispose();
            });
        }
    });

    context.subscriptions.push(sendToGooseDisposable);

    vscode.languages.registerCodeActionsProvider('*', {
        provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken) {
            const codeAction = new vscode.CodeAction('Ask goose to fix it', vscode.CodeActionKind.QuickFix);
            codeAction.command = { command: 'extension.askGooseToFix', title: 'Ask goose to fix it' };
            return [codeAction];
        }
    });

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

        getTerminal().sendText(`Can you look at the code in file: ${filePath} with context: ${tempFileName}. and fix any problems you see around it. Try not to delete content.`);
    });
    context.subscriptions.push(askGooseToFix);
}
