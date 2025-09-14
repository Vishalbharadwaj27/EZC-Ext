const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const OpenRouterAPI = require('./openRouterAPI');

let openRouterAPI = undefined;

function activate(context) {
    console.log('EZ-Coder extension is now active!');

    const config = vscode.workspace.getConfiguration('ez-coder');
    const apiKey = config.get('openRouterApiKey');
    if (apiKey) {
        openRouterAPI = new OpenRouterAPI(apiKey);
    }

    const chatProvider = new ChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider));

    let completeCodeCommand = vscode.commands.registerCommand('ez-coder.completeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor!');
            return;
        }

        if (!openRouterAPI) {
            vscode.window.showErrorMessage('Please set your OpenRouter API key first!');
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

            const apiResponse = await openRouterAPI.completeCode(text, prompt);
            
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
}

class ChatViewProvider {
    static viewType = 'ez-coder.chatView';

    _view;
    _extensionUri;
    _context;

    constructor(extensionUri, context) {
        this._extensionUri = extensionUri;
        this._context = context;
    }

    resolveWebviewView(webviewView, context, token) {
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
                case 'saveApiKey':
                    await vscode.workspace.getConfiguration('ez-coder').update('openRouterApiKey', message.apiKey, true);
                    openRouterAPI = new OpenRouterAPI(message.apiKey);
                    vscode.window.showInformationMessage('API key saved successfully!');
                    break;

                case 'sendMessage':
                    if (!openRouterAPI) {
                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: 'Please set your OpenRouter API key first!',
                            isUser: false
                        });
                        return;
                    }

                    try {
                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: message.text,
                            isUser: true
                        });

                        const systemPrompt = `You are an expert Computer Science educator. Your goal is to explain complex programming concepts in a clear, block-wise, and beginner-friendly way. Follow these rules:

1. Start with a high-level, one-sentence summary of the concept.
2. Explain in logical blocks, not line-by-line. Group related functionality and explain the purpose of each block.
3. Use simple language and helpful analogies where appropriate.
4. After your explanation, include action buttons using these exact tags:
   [BUTTONS]
   - [Generate Pseudocode]
   - [Generate Code]
   [/BUTTONS]

Wrap your entire response in [EXPLANATION]...[/EXPLANATION] tags. Do not include actual code or pseudocode in the explanation.`;

                        const apiResponse = await openRouterAPI.chat([
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: message.text
                            }
                        ]);

                        const explanationMatch = apiResponse.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);

                        if (explanationMatch) {
                            const explanation = explanationMatch[1].trim();
                            this._view.webview.postMessage({
                                command: 'addExplanation',
                                explanation: explanation,
                                originalQuery: message.text,
                                isUser: false
                            });
                        } else {
                            this._view.webview.postMessage({
                                command: 'addMessage',
                                text: apiResponse,
                                isUser: false
                            });
                        }
                    } catch (error) {
                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: 'Error: ' + error.message,
                            isUser: false
                        });
                    }
                    break;

                case 'generatePseudocode':
                    if (!openRouterAPI) {
                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: 'Please set your OpenRouter API key first!',
                            isUser: false
                        });
                        return;
                    }

                    try {
                        const systemPrompt = `You are an expert code generation bot. Your only function is to write clean and clear pseudocode for a given concept. Do not use any specific programming language syntax.`;

                        const apiResponse = await openRouterAPI.chat([
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: `Generate pseudocode for "${message.concept}".`
                            }
                        ]);

                        this._view.webview.postMessage({
                            command: 'addCode', // Re-using addCode to display the pseudocode
                            code: apiResponse,
                        });

                    } catch (error) {
                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: 'Error: ' + error.message,
                            isUser: false
                        });
                    }
                    break;

                case 'generateCode':
                    if (!openRouterAPI) {
                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: 'Please set your OpenRouter API key first!',
                            isUser: false
                        });
                        return;
                    }

                    try {
                        const systemPrompt = `You are an expert code generation bot. Your only function is to write clean, complete, and runnable code for a given concept in a specified language. Your entire response must be ONLY the raw code. Do not use markdown fences or add any explanations.`;

                        const apiResponse = await openRouterAPI.chat([
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: `Generate a code example for "${message.concept}" in ${message.language}.`
                            }
                        ]);

                        this._view.webview.postMessage({
                            command: 'addCode',
                            code: apiResponse,
                        });

                    } catch (error) {
                        this._view.webview.postMessage({
                            command: 'addMessage',
                            text: 'Error: ' + error.message,
                            isUser: false
                        });
                    }
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