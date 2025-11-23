// extension.js
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { callEZCoderAPI } = require("./colabAPI");

const WEBVIEW_FOLDER = "webview";

function getNonce() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

class EZCoderProvider {
    constructor(context) {
        this.context = context;
    }

    resolveWebviewView(webviewView) {
        this.webviewView = webviewView;
        const webview = webviewView.webview;

        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, WEBVIEW_FOLDER)),
            ]
        };

        // Load HTML
        const htmlPath = path.join(
            this.context.extensionPath,
            WEBVIEW_FOLDER,
            "chat.html"
        );
        let html = fs.readFileSync(htmlPath, "utf8");

        const cssUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, WEBVIEW_FOLDER, "chat.css"))
        );
        const jsUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, WEBVIEW_FOLDER, "chat.js"))
        );

        html = html
            .replace("{{cssPath}}", cssUri)
            .replace("{{jsPath}}", jsUri);

        webview.html = html;

        //---------------------------------------------------------------------
        // MESSAGE HANDLING
        //---------------------------------------------------------------------
        webview.onDidReceiveMessage(async (msg) => {
         
          if (msg.command === "sendMessage" && msg.text.trim() === "p2") {
    const prompt = "Continue the previous answer. Continue exactly where you stopped.";
    const response = await callEZCoderAPI(prompt);

    webview.postMessage({
        command: "addCode",
        code: response
    });
    return;
}


            try {
                //-----------------------------------------------------------------
                // SEND BUTTON = EXPLAIN MODE
                //-----------------------------------------------------------------
              if (msg.command === "sendMessage") {
                const prompt =
                  `Explain the following concept in a short, complete, and structured way.
                   Keep the answer concise but complete.
                   Do NOT repeat the prompt.

Concept: ${msg.text}`;

                    const response = await callEZCoderAPI(prompt);

                    webview.postMessage({
                        command: "addExplanation",
                        explanation: response,
                        originalQuery: msg.text,
                    });
                    return;
                }

                //-----------------------------------------------------------------
                // PSEUDOCODE
                //-----------------------------------------------------------------
                if (msg.command === "generatePseudocode") {
                    const prompt =
`Write short but COMPLETE pseudocode for the following concept.
Use clear steps.
Do NOT write real code.
Do NOT add explanations.

Concept: ${msg.concept}`;


                    const response = await callEZCoderAPI(prompt);

                    webview.postMessage({
                        command: "addCode",
                        code: response
                    });
                    return;
                }

                //-----------------------------------------------------------------
                // CODE GENERATION
                //-----------------------------------------------------------------
                if (msg.command === "generateCode") {
                   const prompt =
`Write short but COMPLETE ${msg.language} code for the following concept.
Keep it simple.
Include only required imports.
Do NOT add comments or explanations.

Concept: ${msg.concept}`;


                    const response = await callEZCoderAPI(prompt);

                    webview.postMessage({
                        command: "addCode",
                        code: response
                    });
                    return;
                }

                //-----------------------------------------------------------------
                // CLEAR
                //-----------------------------------------------------------------
                if (msg.command === "clearChat") {
                    webview.postMessage({ command: "clearChat" });
                }

            } catch (err) {
                webview.postMessage({
                    command: "addExplanation",
                    explanation: "Error: " + err.message,
                    originalQuery: ""
                });
            }
        });
    }
}

function activate(context) {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "ez-coder.chatView",
            new EZCoderProvider(context)
        )
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
