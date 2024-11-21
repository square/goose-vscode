import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';

let gooseTerminal: vscode.Terminal | undefined;
const terminalName = '\u2728 goose chat \u2728';

// Profiles interface
interface Profiles {
    [key: string]: {
        provider: string;
        processor: string;
        accelerator: string;
        moderator: string;
        toolkits?: Array<{
            name: string;
            requires: Record<string, unknown>;
        }>;
    }
}

// Webview View Provider
class ProfileFormViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private selectedProfileName: string = '';
    private profiles: Profiles;

    constructor(private readonly context: vscode.ExtensionContext, profiles: Profiles) {
        this.profiles = profiles;
    }

    public setProfileName(profileName: string) {
        this.selectedProfileName = profileName;
        if (this._view) {
            this._view.webview.html = this.getHtmlForWebview();
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.command === 'updateProfile') {
                await vscode.commands.executeCommand('extension.updateProfile', undefined, message);
            }
        });

        webviewView.webview.html = this.getHtmlForWebview();
    }

    private getHtmlForWebview() {
        const profile = this.profiles[this.selectedProfileName] || {
            provider: '',
            processor: '',
            accelerator: '',
            moderator: '',
            toolkits: []
        };

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Profile Form</title>
                <style>
                    body { padding: 10px; }
                    .form-group { margin-bottom: 15px; }
                    label { display: block; margin-bottom: 5px; }
                    select, input, button { width: 100%; padding: 5px; }
                </style>
            </head>
            <body>
                <div class="form-group">
                    <label>Profile: ${this.selectedProfileName}</label>
                    <select id="provider">
                        <option value="anthropic" ${profile.provider === 'anthropic' ? 'selected' : ''}>anthropic</option>
                        <option value="azure" ${profile.provider === 'azure' ? 'selected' : ''}>azure</option>
                        <option value="bedrock" ${profile.provider === 'bedrock' ? 'selected' : ''}>bedrock</option>
                        <option value="block" ${profile.provider === 'block' ? 'selected' : ''}>block</option>
                        <option value="databricks" ${profile.provider === 'databricks' ? 'selected' : ''}>databricks</option>
                        <option value="google" ${profile.provider === 'google' ? 'selected' : ''}>google</option>
                        <option value="ollama" ${profile.provider === 'ollama' ? 'selected' : ''}>ollama</option>
                        <option value="openai" ${profile.provider === 'openai' ? 'selected' : ''}>openai</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Processor:</label>
                    <input type="text" id="processor" value="${profile.processor || ''}">
                </div>
                <div class="form-group">
                    <label>Accelerator:</label>
                    <input type="text" id="accelerator" value="${profile.accelerator || ''}">
                </div>
                <div class="form-group">
                    <label>Moderator:</label>
                    <select id="moderator">
                        <option value="truncate" ${profile.moderator === 'truncate' ? 'selected' : ''}>truncate</option>
                        <option value="none" ${profile.moderator === 'none' ? 'selected' : ''}>none</option>
                    </select>
                </div>
                <button onclick="saveProfile()">Save</button>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function saveProfile() {
                        const data = {
                            provider: document.getElementById('provider').value,
                            processor: document.getElementById('processor').value,
                            accelerator: document.getElementById('accelerator').value,
                            moderator: document.getElementById('moderator').value,
                            toolkits: ${JSON.stringify(profile.toolkits || [])}
                        };
                        
                        vscode.postMessage({
                            command: 'updateProfile',
                            profile: '${this.selectedProfileName}',
                            data: data
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }
}

// Profile Data Provider
class ProfileProvider implements vscode.TreeDataProvider<ProfileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProfileItem | undefined | void> = new vscode.EventEmitter<ProfileItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ProfileItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private profiles: Profiles) {}

    getTreeItem(element: ProfileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProfileItem): Thenable<ProfileItem[]> {
        if (!element) {
            return Promise.resolve(Object.keys(this.profiles).map(name => new ProfileItem(name, vscode.TreeItemCollapsibleState.None)));
        }
        return Promise.resolve([]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

class ProfileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(label, collapsibleState);
        this.contextValue = 'profileItem';
        this.command = { command: 'profileExplorer.select', title: "Select Profile", arguments: [this.label] };
    }
}

export function activate(context: vscode.ExtensionContext) {
    const filePath = path.join(os.homedir(), '.config', 'goose', 'profiles.yaml');
    const profiles: Profiles = yaml.load(fs.readFileSync(filePath, 'utf8')) as Profiles || {} as Profiles;
    const profileProvider = new ProfileProvider(profiles);
    const profileFormProvider = new ProfileFormViewProvider(context, profiles);

    vscode.window.registerTreeDataProvider('profileExplorer', profileProvider);
    vscode.window.registerWebviewViewProvider('profileFormView', profileFormProvider);

    const selectProfileCommand = vscode.commands.registerCommand('profileExplorer.select', (profileName: string) => {
        profileFormProvider.setProfileName(profileName);
        vscode.commands.executeCommand('profileFormView.focus');
    });

    const updateProfileCommand = vscode.commands.registerCommand('extension.updateProfile', (_, message) => {
        profiles[message.profile] = message.data;
        try {
            fs.writeFileSync(filePath, yaml.dump(profiles));
            profileProvider.refresh();
            vscode.window.showInformationMessage(`Profile ${message.profile} updated successfully.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update profile: ${error}`);
        }
    });

    const addProfileCommand = vscode.commands.registerCommand('extension.addProfile', async () => {
        const profileName = await vscode.window.showInputBox({
            placeHolder: 'Enter new profile name'
        });
        
        if (profileName) {
            profiles[profileName] = {
                provider: '',
                processor: '',
                accelerator: '',
                moderator: '',
                toolkits: []
            };
            profileProvider.refresh();
            profileFormProvider.setProfileName(profileName);
        }
    });

    const deleteProfileCommand = vscode.commands.registerCommand('extension.deleteProfile', async (item: ProfileItem) => {
        const profileName = item.label;
        const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to delete profile "${profileName}"?`,
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            delete profiles[profileName];
            fs.writeFileSync(filePath, yaml.dump(profiles));
            profileProvider.refresh();
            vscode.window.showInformationMessage(`Profile ${profileName} deleted.`);
        }
    });

    context.subscriptions.push(selectProfileCommand, updateProfileCommand, addProfileCommand, deleteProfileCommand);

    // Existing terminal and code action commands...
    let getTerminal = () => {
        if (!gooseTerminal || gooseTerminal.exitStatus !== undefined) {
            vscode.window.showInformationMessage('goose agent starting, this may take a minute... ⏰');   
            gooseTerminal = vscode.window.createTerminal({
                name: terminalName,            
                message: 'Loading Goose Session...'
            });            
            gooseTerminal.sendText('goose chat');
        }

        console.log('Goose terminal created:', gooseTerminal.name);
        gooseTerminal.show();
        
        return gooseTerminal;
    }

    let openGooseTerminal = vscode.commands.registerCommand('extension.openGoose', () => {
        getTerminal();
    });
    context.subscriptions.push(openGooseTerminal);

    let openTerminalDisposable = vscode.commands.registerCommand('extension.openGooseTerminal', () => {
        getTerminal();
    });
    context.subscriptions.push(openTerminalDisposable);

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

function createTempFileWithLines(selectedText: string, startLine: number): string {
    const selectedLines = selectedText.split('\n').map((line, index) => `${startLine + index}: ${line}`).join('\n');
    const tempDir = os.tmpdir();
    const tempFileName = path.join(tempDir, `goose_context_${Date.now()}.txt`);
    fs.writeFileSync(tempFileName, selectedLines);
    return tempFileName;
}
