import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';

let gooseProcess: ChildProcess | undefined;
const terminalName = '';

export function activate(context: vscode.ExtensionContext) {

    // Check if goose CLI is installed
    const config = vscode.workspace.getConfiguration('goose');
    let defaultCommand = config.get('defaultCommand', "goose session start");    
    try {
        execSync('goose version');
    } catch (error) {
        try {
            execSync('sq goose version');
            defaultCommand = 'sq goose session start';                        
        } catch (error) {
            vscode.window.showWarningMessage(`If goose isn't working, please check the goose command line tool is installed and working.`);
        }
    }
    
    vscode.window.showInformationMessage('goose agent starting, this may take a minute.. ');

    // Start goose process in hidden mode
    let startGooseProcess = () => {
        gooseProcess = spawn(defaultCommand, {
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        if (gooseProcess.stdout) {
            gooseProcess.stdout.on('data', (data) => {
                let output = data.toString();
                SidePanel.postMessage({ type: 'terminalOutput', text: output });
            });
        }
        if (gooseProcess.stderr) {
            gooseProcess.stderr.on('data', (data) => {
                let errorOutput = data.toString();
                SidePanel.postMessage({ type: 'terminalOutput', text: errorOutput });
            });
        }
        if (gooseProcess.stdin) {
            gooseProcess.on('close', (code) => {
                console.log(`Goose process exited with code ${code}`);
                SidePanel.postMessage({ type: 'terminalOutput', text: `Goose process exited with code ${code}` });
            });
        }
    }

    // Start the process on activation
    startGooseProcess();

    // Register the command to open the sidepanel
    let disposable = vscode.commands.registerCommand('extension.openSidepanel', () => {
        SidePanel.createOrShow(context.extensionPath);
    });
    context.subscriptions.push(disposable);

    class SidePanel {
        public static currentPanel: SidePanel | undefined;
        private readonly _panel: vscode.WebviewPanel;
        private readonly _extensionPath: string;
        private _disposables: vscode.Disposable[] = [];

        public static postMessage(message: any) {
            if (SidePanel.currentPanel) {
                SidePanel.currentPanel._panel.webview.postMessage(message);
            }
        }

        public static createOrShow(extensionPath: string) {
            if (SidePanel.currentPanel) {
                SidePanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
                return;
            }

            const panel = vscode.window.createWebviewPanel(
                'sidepanel',
                '🪿 Ask Goose 🪿',
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
                            if (gooseProcess && gooseProcess.stdin) {
                                gooseProcess.stdin.write(message.text + '\n');
                            }
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
`;

            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sidepanel</title>
    <style>
        body { font-family: 'Courier New', monospace; padding: 10px; background-color: #222; color: #ccc; }
        #inputContainer { position: fixed; bottom: 0; width: 100%; background-color: #333; padding: 10px; }
        #userInput { width: 100%; padding: 5px; }
        #outputContainer { margin-top: 20px; height: 300px; overflow-y: auto; white-space: pre-wrap; background-color: #333; color: #ccc; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <div id="markdownContent">
        ${markdownContent.replace(/`/g, '\`')}
    </div>
    <div id="outputContainer">
        <h3>Goose Output:</h3>
        <div id="gooseOutput"></div>
    </div>
    <div id="inputContainer">
        <input type="text" id="userInput" placeholder="Enter your input here" />
    </div>
    <script>
        const vscode = acquireVsCodeApi();

        window.addEventListener('message', event => {
            const message = event.data; // The JSON data sent by the extension
            switch (message.type) {
                case 'terminalOutput':
                    const outputDiv = document.getElementById('gooseOutput');
                    outputDiv.textContent += message.text;
                    break;
            }
        });

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

    context.subscriptions.push(disposable);
}

export function deactivate() {
    if (gooseProcess) {
        gooseProcess.kill();
    }
}
