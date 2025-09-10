const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const OpenRouterAPI = require('./openRouterAPI');

let chatPanel = undefined;
let openRouterAPI = undefined;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('EZ-Coder extension is now active!');

    // Initialize OpenRouter API with stored key if it exists
    const config = vscode.workspace.getConfiguration('ez-coder');
    const apiKey = config.get('openRouterApiKey');
    if (apiKey) {
        openRouterAPI = new OpenRouterAPI(apiKey);
    }

    // Register the AI Chat command
    let openChatCommand = vscode.commands.registerCommand('ez-coder.openAIChat', () => {
        if (chatPanel) {
            chatPanel.reveal(vscode.ViewColumn.Two);
        } else {
            createChatPanel(context);
        }
    });

    // Register the Code Completion command
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

            const response = await openRouterAPI.completeCode(text, prompt);
            
            // Extract code from the response (assuming it's wrapped in ```code blocks)
            const codeMatch = response.match(/```(?:\w+)?\n([\s\S]+?)```/);
            const codeToInsert = codeMatch ? codeMatch[1] : response;

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

    context.subscriptions.push(openChatCommand, completeCodeCommand);
}

function createChatPanel(context) {
    chatPanel = vscode.window.createWebviewPanel(
        'ezCoderChat',
        'EZ-Coder Chat',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'webview'))
            ]
        }
    );

    const htmlPath = path.join(context.extensionPath, 'webview', 'chat.html');
    const cssPath = path.join(context.extensionPath, 'webview', 'chat.css');
    const jsPath = path.join(context.extensionPath, 'webview', 'chat.js');

    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // Convert CSS and JS paths to webview URIs
    const cssUri = chatPanel.webview.asWebviewUri(vscode.Uri.file(cssPath));
    const jsUri = chatPanel.webview.asWebviewUri(vscode.Uri.file(jsPath));
    
    html = html.replace('{{cssPath}}', cssUri.toString())
               .replace('{{jsPath}}', jsUri.toString());

    chatPanel.webview.html = html;

    // Handle messages from the webview
    chatPanel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
            case 'saveApiKey':
                await vscode.workspace.getConfiguration('ez-coder').update('openRouterApiKey', message.apiKey, true);
                openRouterAPI = new OpenRouterAPI(message.apiKey);
                vscode.window.showInformationMessage('API key saved successfully!');
                break;

            case 'sendMessage':
                if (!openRouterAPI) {
                    chatPanel.webview.postMessage({
                        command: 'addMessage',
                        text: 'Please set your OpenRouter API key first!',
                        isUser: false
                    });
                    return;
                }

                try {
                    chatPanel.webview.postMessage({
                        command: 'addMessage',
                        text: message.text,
                        isUser: true
                    });

                    const response = await openRouterAPI.chat([
                        {
                            role: 'system',
                            content: 'You are a helpful coding assistant, focused on helping beginners learn to code. Provide clear, detailed explanations and examples.'
                        },
                        {
                            role: 'user',
                            content: message.text
                        }
                    ]);

                    chatPanel.webview.postMessage({
                        command: 'addMessage',
                        text: response,
                        isUser: false
                    });
                } catch (error) {
                    chatPanel.webview.postMessage({
                        command: 'addMessage',
                        text: 'Error: ' + error.message,
                        isUser: false
                    });
                }
                break;
        }
    });

    chatPanel.onDidDispose(() => {
        chatPanel = undefined;
    }, null, context.subscriptions);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
