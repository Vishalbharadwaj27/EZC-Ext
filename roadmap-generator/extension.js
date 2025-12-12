// extension.js
const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("Roadmap Generator extension is now active");

  // Command id must match package.json
  const disposable = vscode.commands.registerCommand(
    "roadmap-generator.open",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "roadmapGenerator",
        "Roadmap Generator",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          // Allow webview to load files from /media
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "media"),
          ],
        }
      );

      panel.webview.html = getWebviewContent(panel.webview, context);
    }
  );

  context.subscriptions.push(disposable);
}

function getWebviewContent(webview, context) {
  const mediaRoot = vscode.Uri.joinPath(context.extensionUri, "media");

  // 🔥 Use your real bundle filenames
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(mediaRoot, "assets", "index-CGf0oPwP.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(mediaRoot, "assets", "index-dgf5YC8O.css")
  );

  const nonce = getNonce();

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="
        default-src 'none';
        img-src ${webview.cspSource} https:;
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src 'nonce-${nonce}';
        connect-src http://localhost:5178;
      "
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Roadmap Generator</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- Vite bundle is an ES module -->
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
