const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { callEZCoderAPI } = require('./colabAPI');
const HuggingFaceAPI = require('./huggingFaceAPI');
// Instantiate HuggingFace API client if key is provided
const huggingFaceAPI = process.env.HF_API_KEY ? new HuggingFaceAPI(process.env.HF_API_KEY) : null;
require('dotenv').config({ path: path.join(__dirname, '.env') });

function activate(context) {
    console.log('ez-coder extension is now active!');

    const chatProvider = new ChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider));

    let completeCodeCommand = vscode.commands.registerCommand('ez-coder.completeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor!');
            return;
        }

        const prompt = await vscode.window.showInputBox({
            placeHolder: "Describe what you want to do...",
            prompt: "Enter your code completion request"
        });

        if (!prompt) return;

        try {
            const document = editor.document;
            const selection = editor.selection;
            const text = document.getText();

            const apiResponse = await callEZCoderAPI(prompt + "\nContext:\n" + text);
            
            const codeMatch = apiResponse.match(/```(?:\\w+)?\n([\s\S]+?)```/);
            const codeToInsert = codeMatch ? codeMatch[1] : apiResponse;

            editor.edit(editBuilder => {
                if (selection.isEmpty) {
                    editBuilder.insert(selection.active, codeToInsert);
                } else {
                    editBuilder.replace(selection, codeToInsert);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to complete code: ' + error.message);
        }
    });

    context.subscriptions.push(completeCodeCommand);

    context.subscriptions.push(vscode.commands.registerCommand('ez-coder.clearChat', () => {
        if (chatProvider && chatProvider._view) {
            chatProvider._view.webview.postMessage({ command: 'clearChat' });
        }
    }));
}

class ChatViewProvider {
    static viewType = 'ez-coder.chatView';

    constructor(extensionUri, context) {
        this._extensionUri = extensionUri;
        this._context = context;
        this._view = undefined;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'webview')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'sendMessage':
                    try {
                        // Proxy the webview request to the configured FastAPI endpoint to avoid CORS.
                        const apiBase = vscode.workspace.getConfiguration('ezcoder').get('apiBase');
                        if (!apiBase) {
                            this._view.webview.postMessage({
                                command: 'addMessage',
                                text: 'Error: ezcoder.apiBase is not configured. Set it in Settings.',
                                isUser: false
                            });
                            break;
                        }
                        console.log("🔗 Sending to:", `${apiBase}/generate`);

                        const res = await fetch(`${apiBase}/generate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                prompt: message.prompt || message.text,   // ✅ ensures the field exists
                                max_new_tokens: 256,
                                temperature: 0.7,
                                top_p: 0.95
                            }),
                        });


                        if (!res.ok) {
                            const body = await res.text();
                            throw new Error(`HTTP ${res.status}: ${body}`);
                        }

                        const data = await res.json();
                        // Support several response shapes commonly used: { text: '...' } or HF style
                        const apiResponse = (data && (data.text || data[0]?.generated_text || data.generated_text)) || JSON.stringify(data);

                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: apiResponse,
                            isUser: false
                        });
                    } catch (error) {
                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: 'Error: ' + String(error.message || error),
                            isUser: false
                        });
                    }
                    break;

                case 'generateCode':
                    if (!huggingFaceAPI) {
                        this._view.webview.postMessage({ command: 'showAuthError' });
                        return;
                    }

                    try {
                        const systemPrompt = `You are an expert code generation bot. Your only function is to write clean, complete, and runnable code for a given concept in a specified language. Your entire response must be ONLY the raw code. Do not use markdown fences or add any explanations.`;

                        const apiResponse = await huggingFaceAPI.chat(
                            `System: ${systemPrompt}\nUser: Generate a code example for "${message.concept}" in ${message.language}.`
                        );

                        this._view.webview.postMessage({
                            command: 'addCode',
                            code: apiResponse,
                        });

                    } catch (error) {
                        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                            this._view.webview.postMessage({
                                command: 'showAuthError'
                            });
                        } else {
                            vscode.window.showErrorMessage('Failed to get code: ' + error.message);
                        }
                    }
                    break;

                case 'generatePseudocode':
                    if (!huggingFaceAPI) {
                        this._view.webview.postMessage({ command: 'showAuthError' });
                        return;
                    }

                    try {
                        const systemPrompt = `You are an expert code generation bot. Your only function is to write clean and clear pseudocode for a given concept. Do not use any specific programming language syntax.`;

                        const apiResponse = await huggingFaceAPI.chat(
                           `System: ${systemPrompt}\nUser: Generate pseudocode for "${message.concept}".`
                        );

                        this._view.webview.postMessage({
                            command: 'addCode', 
                            code: apiResponse,
                        });

                    } catch (error) {
                        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                            this._view.webview.postMessage({
                                command: 'showAuthError'
                            });
                        } else {
                            vscode.window.showErrorMessage('Failed to get pseudocode: ' + error.message);
                        }
                    }
                    break;
                
                case 'runVerification':
                    vscode.commands.executeCommand('ez-coder.verifyApiKey');
                    break;
            }
        });
    }

    _getHtmlForWebview(webview) {
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'chat.html');
        const cssPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'chat.css');
        const jsPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'chat.js');

        const cssUri = webview.asWebviewUri(cssPath);
        const jsUri = webview.asWebviewUri(jsPath);

        let html = fs.readFileSync(htmlPath.fsPath, 'utf8');
        html = html.replace('{{cssPath}}', cssUri.toString())
                   .replace('{{jsPath}}', jsUri.toString());

        return html;
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};