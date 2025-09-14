const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const OpenRouterAPI = require('./openRouterAPI');

let openRouterAPI = undefined;

function activate(context) {
    console.log('EZ-Coder extension is now active!');

    try {
        openRouterAPI = new OpenRouterAPI();
    } catch (error) {
        openRouterAPI = undefined;
        vscode.window.showErrorMessage(`Failed to initialize OpenRouter API: ${error.message}`);
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
            vscode.window.showErrorMessage('API key not found. Please set your OpenRouter API key in the VS Code settings for EZ-Coder.');
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
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                vscode.window.showErrorMessage('Authentication Error: Invalid API Key.');
            } else {
                vscode.window.showErrorMessage('Failed to complete code: ' + error.message);
            }
        }
    });

    context.subscriptions.push(completeCodeCommand);

    let verifyApiKeyCommand = vscode.commands.registerCommand('ez-coder.verifyApiKey', async () => {
        const tempAPI = new OpenRouterAPI();
        const result = await tempAPI.testConnection();

        if (result.success) {
            vscode.window.showInformationMessage('Success! Your OpenRouter API key is valid.');
        } else if (result.statusCode === 401) {
            vscode.window.showErrorMessage('Verification Failed: The API key is invalid or unauthorized. Please check your key and try again.');
        } else {
            vscode.window.showErrorMessage(`Verification Failed: Could not connect to OpenRouter. (Status Code: ${result.statusCode})`);
        }
    });

    context.subscriptions.push(verifyApiKeyCommand);
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
                case 'sendMessage':
                    if (!openRouterAPI) {
                        this._view.webview.postMessage({ command: 'showAuthError' });
                        return;
                    }

                    this._view.webview.postMessage({
                        command: 'addMessage',
                        text: message.text,
                        isUser: true
                    });

                    if (message.action === 'pseudocode') {
                        try {
                            const systemPrompt = `You are an expert code generation bot. Your only function is to write clean and clear pseudocode for a given concept. Do not use any specific programming language syntax.`;

                            const apiResponse = await openRouterAPI.chat([
                                {
                                    role: 'system',
                                    content: systemPrompt
                                },
                                {
                                    role: 'user',
                                    content: `Generate pseudocode for "${message.text}".`
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
                    } else {
                        try {
                            let systemPrompt;
                            if (message.action === 'explain') {
                                systemPrompt = `You are an expert Computer Science educator. Your goal is to explain complex programming concepts in a clear, well-structured, and beginner-friendly way. Follow these rules:\n1. Start with a high-level summary paragraph\n2. Use bullet points or numbered lists to break down key steps or components\n3. Group related concepts together\n4. Use simple language and helpful analogies\n5. Format the output to be easy to read with proper spacing and structure\n\nYour response should be ONLY the explanation, without any code examples or additional suggestions.`;
                            } else {
                                // Default flow - Explanation with follow-up buttons
                                systemPrompt = `You are an expert Computer Science educator. Explain the concept clearly and concisely. Rules:\n1. Start with a high-level summary\n2. Break down the explanation into logical blocks\n3. Use simple language and analogies where helpful\n4. Format for readability with proper spacing\n\nWrap your response in [EXPLANATION]...[/EXPLANATION] tags.\nAfter the explanation, the UI will automatically show options to generate pseudocode or code examples.`;
                            }

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

                            let responseType = message.action || 'explain';
                            let responseMatch;

                            if (responseType === 'explain') {
                                responseMatch = apiResponse.match(/ \[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
                                if (responseMatch) {
                                    this._view.webview.postMessage({
                                        command: 'addExplanation',
                                        explanation: responseMatch[1].trim(),
                                        originalQuery: message.text,
                                        isUser: false,
                                        showActions: responseType === 'explain'
                                    });
                                }
                            }

                            if (!responseMatch) {
                                this._view.webview.postMessage({
                                    command: 'addMessage',
                                    text: apiResponse,
                                    isUser: false
                                });
                            }
                        } catch (error) {
                            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                                this._view.webview.postMessage({
                                    command: 'showAuthError'
                                });
                            } else {
                                vscode.window.showErrorMessage('Failed to get response: ' + error.message);
                            }
                        }
                    }
                    break;

                case 'generatePseudocode':
                    if (!openRouterAPI) {
                        this._view.webview.postMessage({ command: 'showAuthError' });
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
                        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                            this._view.webview.postMessage({
                                command: 'showAuthError'
                            });
                        } else {
                            vscode.window.showErrorMessage('Failed to get pseudocode: ' + error.message);
                        }
                    }
                    break;

                case 'generateCode':
                    if (!openRouterAPI) {
                        this._view.webview.postMessage({ command: 'showAuthError' });
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
                        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                            this._view.webview.postMessage({
                                command: 'showAuthError'
                            });
                        } else {
                            vscode.window.showErrorMessage('Failed to get code: ' + error.message);
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
