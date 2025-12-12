// extension.js - Unified Extension (EZCoder + Roadmap Generator + Professional CodeViz)
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { callEZCoderAPI } = require("./colabAPI");
const { retryAsync } = require("./lib/retry");
const { ANTIGRAVITY_SYSTEM_PROMPT, P2_PROMPT_TEMPLATE } = require("./systemPrompt");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer-core");
const acorn = require("acorn");
const { spawn } = require("child_process");

const WEBVIEW_FOLDER = "webview";

// Keep a reference to the active CodeViz panel
let globalCodeVizPanel = null;

// CodeViz ready state and message queue
let globalCodeVizPanelReady = false;
let globalCodeVizMessageQueue = [];

// Roadmap server process
let globalRoadmapServer = null;

// Robust sender that posts to the active CodeViz webview and retries on failure
function sendMessageToCodeViz(msg) {
    if (!globalCodeVizPanel) {
        console.warn('[Extension] sendMessageToCodeViz: no active panel, queueing message');
        msg._attempts = (msg._attempts || 0) + 1;
        if (msg._attempts <= 6) globalCodeVizMessageQueue.push(msg);
        return false;
    }

    try {
        // Use robust sender to deliver message (queues if panel not ready)
        globalCodeVizPanel.webview.postMessage(msg);
        return true;
    } catch (err) {
        console.warn('[Extension] sendMessageToCodeViz postMessage failed:', err && err.message ? err.message : err);
        msg._attempts = (msg._attempts || 0) + 1;
        if (msg._attempts > 6) {
            console.error('[Extension] Dropping CodeViz message after too many attempts', msg);
            try { vscode.window.showErrorMessage('CodeViz: failed to send visualization after multiple attempts.'); } catch (e) { }
            return false;
        }
        globalCodeVizMessageQueue.push(msg);
        const delay = 200 * Math.min(msg._attempts, 10);
        setTimeout(() => {
            if (!globalCodeVizPanel || !globalCodeVizPanelReady) return;
            const queued = globalCodeVizMessageQueue.shift();
            if (queued) sendMessageToCodeViz(queued);
        }, delay);
        return false;
    }
}

// Wait for CodeViz webview to signal ready, with timeout (ms)
function waitForCodeVizReady(timeoutMs = 3000) {
    return new Promise((resolve) => {
        if (globalCodeVizPanelReady) return resolve(true);
        const start = Date.now();
        const iv = setInterval(() => {
            if (globalCodeVizPanelReady) {
                clearInterval(iv);
                return resolve(true);
            }
            if (Date.now() - start > timeoutMs) {
                clearInterval(iv);
                return resolve(false);
            }
        }, 100);
    });
}

// Generic safe poster for any webview: retries with backoff if postMessage throws
function safePost(webview, msg, maxAttempts = 6) {
    try {
        // Attempt immediate post
        webview.postMessage(msg);
        return true;
    } catch (err) {
        console.warn('[Extension] safePost: immediate postMessage failed:', err && err.message ? err.message : err);
        msg._attempts = (msg._attempts || 0) + 1;
        if (msg._attempts > maxAttempts) {
            console.error('[Extension] safePost: dropping message after too many attempts', msg);
            return false;
        }
        const delay = 150 * Math.min(msg._attempts, 20);
        setTimeout(() => {
            try {
                webview.postMessage(msg);
            } catch (err2) {
                // recursive retry
                safePost(webview, msg, maxAttempts);
            }
        }, delay);
        return false;
    }
}

// --- SERVER HEALTH CHECK (Roadmap) ---
async function checkRoadmapServerHealth() {
    try {
        const response = await fetch('http://localhost:5178/health', { timeout: 2000 });
        if (response.ok) {
            console.log("[Extension] ✅ Roadmap server is running on http://localhost:5178");
            return true;
        }
    } catch (err) {
        console.warn("[Extension] ⚠️ Roadmap server not available at localhost:5178");
    }
    return false;
}

// --- PDF GENERATION (Roadmap) ---
async function generatePdfFromHtml(htmlContent) {
    console.log("[PDF] Starting PDF generation with puppeteer-core");
    let browser = null;
    try {
        let executablePath;
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
            'C:\\Program Files\\Chromium\\Application\\chrome.exe',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        ];

        for (const checkPath of possiblePaths) {
            if (fs.existsSync(checkPath)) {
                executablePath = checkPath;
                break;
            }
        }

        if (!executablePath) {
            throw new Error("Chrome/Chromium not found. Please install Google Chrome or Chromium.");
        }

        browser = await puppeteer.launch({
            executablePath: executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
        });

        await page.close();
        await browser.close();
        return pdfBuffer;
    } catch (err) {
        console.error("[PDF] Error:", err.message);
        if (browser) await browser.close().catch(() => { });
        throw new Error("PDF generation failed: " + err.message);
    }
}

// --- COMMAND CONSTANTS ---
const CMD_OPEN_ROADMAP = "open.roadmap";
const LEGACY_OPEN_ROADMAP = "openRoadmap";
const CMD_ROADMAP_GENERATE = "roadmap.generate";
const CMD_ROADMAP_EXPORT = "roadmap.export";

function getNonce() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

// --- RETRY-WRAPPED API CALL ---
async function callEZCoderAPIWithRetry(prompt) {
    return retryAsync(
        () => callEZCoderAPI(prompt),
        {
            retries: 5,
            minDelay: 800,
            maxDelay: 8000,
            factor: 2,
            jitter: true,
            shouldRetry: (err) => {
                // Retry on transient errors
                const msg = (err && err.message) ? err.message.toLowerCase() : '';
                if (msg.includes('model is overloaded') ||
                    msg.includes('rate limit') ||
                    msg.includes('timeout') ||
                    msg.includes('502') ||
                    msg.includes('503') ||
                    msg.includes('504') ||
                    msg.includes('connection')) {
                    return true;
                }
                // Optionally retry on network fetch failures
                if (err && err.code && ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) {
                    return true;
                }
                return false;
            },
            onRetry: (attempt, delay, err) => {
                console.warn(`[EZCoderAPI] Retry attempt ${attempt}/5 — waiting ${delay}ms. Error: ${err.message}`);
            }
        }
    ).catch(err => {
        // Log and notify user clearly
        console.error('[EZCoderAPI] Request failed after retries:', err);
        vscode.window.showErrorMessage('AI service unavailable or overloaded. Please try again in a few minutes.');
        // Re-throw so UI code can handle it
        throw err;
    });
}

// --- EZCODER CHAT PROVIDER ---
class EZCoderProvider {
    constructor(context) {
        this.context = context;
        this.lastUserPrompt = "";
        this.lastModelResponse = "";
    }

    resolveWebviewView(webviewView) {
        this.webviewView = webviewView;
        const webview = webviewView.webview;

        webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, WEBVIEW_FOLDER))]
        };

        const htmlPath = path.join(this.context.extensionPath, WEBVIEW_FOLDER, "chat.html");
        let html = fs.readFileSync(htmlPath, "utf8");

        const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, WEBVIEW_FOLDER, "chat.css")));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, WEBVIEW_FOLDER, "chat.js")));

        html = html.replace("{{cssPath}}", cssUri).replace("{{jsPath}}", jsUri);
        webview.html = html;

        webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === "sendMessage" && msg.text.trim().toLowerCase() === "p2") {
                if (!this.lastUserPrompt || !this.lastModelResponse) {
                    safePost(webview, { command: "addExplanation", explanation: "Error: No previous conversation to continue. Please ask a question first.", originalQuery: "p2" });
                    return;
                }
                const p2Prompt = P2_PROMPT_TEMPLATE
                    .replace('<ORIGINAL_USER_PROMPT>', this.lastUserPrompt)
                    .replace('<LAST_ANSWER>', this.lastModelResponse);

                try {
                    const response = await callEZCoderAPIWithRetry(p2Prompt);
                    this.lastModelResponse += response; // Append to history
                    safePost(webview, { command: "addCode", code: response });
                } catch (err) {
                    safePost(webview, { command: "addExplanation", explanation: "Error continuing code: " + err.message, originalQuery: "p2" });
                }
                return;
            }

            if (msg.command === CMD_OPEN_ROADMAP || msg.command === LEGACY_OPEN_ROADMAP) {
                openRoadmapGenerator(this.context);
                return;
            }

            try {
                if (msg.command === 'executeCommand' && msg.commandToRun) {
                    await vscode.commands.executeCommand(msg.commandToRun);
                    return;
                }
                if (msg.command === "sendMessage") {
                    this.lastUserPrompt = msg.text;
                    const prompt = ANTIGRAVITY_SYSTEM_PROMPT + "\n\nUser Request:\n" + msg.text;
                    const response = await callEZCoderAPIWithRetry(prompt);
                    this.lastModelResponse = response;
                    safePost(webview, { command: "addExplanation", explanation: response, originalQuery: msg.text });
                    return;
                }
                if (msg.command === "generatePseudocode") {
                    const prompt = `Write short but COMPLETE pseudocode for: ${msg.concept}`;
                    const response = await callEZCoderAPIWithRetry(prompt);
                    safePost(webview, { command: "addCode", code: response });
                    return;
                }
                if (msg.command === "generateCode") {
                    const prompt = `Write short but COMPLETE ${msg.language} code for: ${msg.concept}`;
                    const response = await callEZCoderAPIWithRetry(prompt);
                    safePost(webview, { command: "addCode", code: response });
                    return;
                }
                if (msg.command === "clearChat") {
                    safePost(webview, { command: "clearChat" });
                }
            } catch (err) {
                safePost(webview, { command: "addExplanation", explanation: "Error: " + err.message, originalQuery: "" });
            }
        });
    }
}

// --- ROADMAP GENERATOR ---
function openRoadmapGenerator(context) {
    const panel = vscode.window.createWebviewPanel(
        "roadmapGenerator", "Roadmap Generator", vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, "roadmap-generator", "media"),
                vscode.Uri.joinPath(context.extensionUri, "roadmap-generator", "webview"),
            ],
        }
    );

    panel.webview.html = getRoadmapWebviewContent(panel.webview, context);
    const panelState = { context: context, latestHtml: null };

    panel.webview.onDidReceiveMessage(async (msg) => {
        try {
            if (!msg || !msg.command) return;

            if (msg.command === CMD_ROADMAP_GENERATE) {
                const data = msg.data || {};
                const projectName = data.projectName || "Project";
                const scope = data.scope || "general";
                const prompt = 'You are an expert course designer. Create a learning roadmap for "' + projectName + '" for "' + scope + '" learners. Output valid HTML with <h2>, <h3>, <ul><li>. Include clickable links.';

                try {
                    const response = await fetch('http://localhost:5178/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: prompt })
                    });

                    const responseText = await response.text();
                    let data_res;
                    try { data_res = JSON.parse(responseText); } catch (e) { throw new Error("Invalid server response"); }

                    if (!response.ok || !data_res.ok) throw new Error(data_res.error || 'Server error');

                    const html = '<div class="rg-generated">' + data_res.text + '</div>';
                    panelState.latestHtml = html;
                    safePost(panel.webview, { command: 'roadmap.result', html: html });
                    vscode.window.showInformationMessage("Roadmap generated!");
                } catch (err) {
                    const errHtml = '<div class="rg-error">Error: ' + escapeHtml(err.message) + '</div>';
                    safePost(panel.webview, { command: 'roadmap.result', html: errHtml });
                }
                return;
            }

            if (msg.command === CMD_ROADMAP_EXPORT) {
                if (!panelState.latestHtml) {
                    vscode.window.showWarningMessage("Generate a roadmap first.");
                    return;
                }
                try {
                    const style = '<style>body { font-family: Arial; margin: 20px; }</style>';
                    const fullHtml = '<html><head>' + style + '</head><body>' + panelState.latestHtml + '</body></html>';
                    const pdfBuffer = await generatePdfFromHtml(fullHtml);
                    const fileName = 'roadmap-' + Date.now() + '.pdf';
                    const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(fileName), filters: { 'PDF': ['pdf'] } });
                    if (uri) {
                        await vscode.workspace.fs.writeFile(uri, pdfBuffer);
                        vscode.window.showInformationMessage('Exported to: ' + uri.fsPath);
                    }
                } catch (err) {
                    vscode.window.showErrorMessage('Export failed: ' + err.message);
                }
            }
        } catch (err) {
            vscode.window.showErrorMessage('Roadmap error: ' + err.message);
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getRoadmapWebviewContent(webview, context) {
    const webviewHtmlPath = path.join(context.extensionPath, 'roadmap-generator', 'webview', 'index.html');
    let html = fs.readFileSync(webviewHtmlPath, 'utf8');
    const nonce = getNonce();
    const cssLocal = webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'roadmap-generator', 'webview', 'index.css'))).toString();
    const jsLocal = webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'roadmap-generator', 'webview', 'index.js'))).toString();
    const mediaAssetsBase = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'roadmap-generator', 'media', 'assets')).toString();

    html = html.replace(/href="\.\/index.css"/g, `href="${cssLocal}"`);
    html = html.replace(/src="\.\/index.js"/g, `src="${jsLocal}" nonce="${nonce}"`);
    html = html.replace(/\/(assets)\//g, `${mediaAssetsBase}/`);
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src http://localhost:5178;" />`;
    html = html.replace(/<head>/i, `<head>\n    ${cspMeta}`);
    return html;
}

// -------------------------------------------------------------------------
// CODE VISUALIZER MODULE (Professional Fix)
// -------------------------------------------------------------------------

function openCodeVizPanel(context) {
    if (globalCodeVizPanel) {
        try { globalCodeVizPanel.reveal(vscode.ViewColumn.One); } catch (e) { }
        return;
    }

    const panel = vscode.window.createWebviewPanel(
        "unified.codeviz",
        "CodeViz",
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'codeviz', 'codeviz', 'media')]
        }
    );

    const codevizRoot = path.join(context.extensionPath, 'codeviz', 'codeviz');
    const mediaDir = path.join(codevizRoot, 'media');

    // --- PATH FIX: Point to the correct files (viz.js and viz.full.render.js) ---
    // Make sure 'npm run compile' copied these here!
    const mainLib = path.join(mediaDir, 'viz.js');
    const workerLib = path.join(mediaDir, 'viz.full.render.js');
    const webviewJsPath = path.join(mediaDir, 'webview.js');
    const cssPath = path.join(mediaDir, 'webview.css');

    if (!fs.existsSync(mainLib) || !fs.existsSync(workerLib)) {
        vscode.window.showErrorMessage('CodeViz Error: Missing Viz.js files in media folder. Please run npm run compile.');
        return;
    }

    console.log('[CodeViz] Media files verified:');
    console.log('  - mainLib:', mainLib);
    console.log('  - workerLib:', workerLib);
    console.log('  - webviewJs:', webviewJsPath);
    console.log('  - css:', cssPath);

    globalCodeVizPanel = panel;
    panel.onDidDispose(() => {
        globalCodeVizPanel = null;
        globalCodeVizPanelReady = false;
        globalCodeVizMessageQueue = [];
    });

    const webview = panel.webview;
    const nonce = getNonce();



    // Convert paths to URIs safely - use forward slashes
    const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath)).toString();
    const mainUri = webview.asWebviewUri(vscode.Uri.file(mainLib)).toString();
    const workerUri = webview.asWebviewUri(vscode.Uri.file(workerLib)).toString();
    const webviewJsUri = webview.asWebviewUri(vscode.Uri.file(webviewJsPath)).toString();

    console.log('[CodeViz] Generated URIs:');
    console.log('  - cssUri:', cssUri);
    console.log('  - mainUri:', mainUri);
    console.log('  - workerUri:', workerUri);
    console.log('  - webviewJsUri:', webviewJsUri);

    // --- CSP: Allow blob: for worker ---
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} blob: https:; connect-src ${webview.cspSource} blob: https: http:; worker-src blob: ${webview.cspSource};" />`;

    const html = `<!doctype html>
<html>
  <head>
    ${cspMeta}
    <meta charset="utf-8" />
    <link rel="stylesheet" href="${cssUri}" />
    <style>
        /* Professional Theme */
        :root { --bg: #ffffff; --text: #333; --border: #e0e0e0; --accent: #007acc; }
        body { margin: 0; width: 100vw; height: 100vh; background: var(--bg); color: var(--text); font-family: 'Segoe UI', sans-serif; overflow: hidden; display: flex; flex-direction: column; }
        header { height: 50px; padding: 0 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); background: #f8f9fa; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        h1 { font-size: 15px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
        .badge { padding: 4px 10px; border-radius: 12px; color: white; font-weight: 600; font-size: 12px; }
        .badge.green { background: #2e7d32; }
        .badge.orange { background: #f57f17; }
        .badge.red { background: #c62828; }
        #viewport { flex: 1; overflow: hidden; position: relative; cursor: grab; background: radial-gradient(#f0f0f0 1px, transparent 1px); background-size: 20px 20px; }
        #viewport:active { cursor: grabbing; }
        #graph-container { position: absolute; top: 0; left: 0; transform-origin: 0 0; transition: transform 0.1s linear; }
        #controls { position: absolute; bottom: 25px; right: 25px; display: flex; flex-direction: column; gap: 8px; z-index: 100; }
        button.fab { width: 40px; height: 40px; border-radius: 50%; border: 1px solid #ddd; background: white; color: #555; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-size: 18px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        button.fab:hover { background: #007acc; color: white; transform: translateY(-2px); box-shadow: 0 6px 8px rgba(0,0,0,0.15); }
        .node { cursor: pointer; transition: opacity 0.2s; }
        .node:hover polygon, .node:hover ellipse { stroke: #007acc !important; stroke-width: 2px !important; filter: drop-shadow(0 0 5px rgba(0,122,204,0.4)); }
    </style>
    <script nonce="${nonce}">
        // Inject Paths
        (function(){
            window.__vizMain = '${mainUri}';
            window.__vizWorker = '${workerUri}';
        })();
    </script>
  </head>
  <body>
    <header>
      <h1 id="func-title">Select a Function</h1>
      <span id="meter-badge" class="badge green">Ready</span>
    </header>
    <div id="viewport">
      <div id="graph-container"></div>
    </div>
    <div id="controls">
        <button class="fab" id="btn-reset" title="Reset">⟲</button>
        <button class="fab" id="btn-zoom-in" title="Zoom In">+</button>
        <button class="fab" id="btn-zoom-out" title="Zoom Out">−</button>
    </div>
    <script nonce="${nonce}" src="${webviewJsUri}"></script>
  </body>
</html>`;

    // Set up message listener BEFORE setting HTML (important for message delivery)
    panel.webview.onDidReceiveMessage((message) => {
        // Safely stringify incoming message for logging to avoid URI revive errors
        let msgStr = '';
        try {
            msgStr = JSON.stringify(message, (k, v) => {
                // If v looks like a VSCode URI serialization, avoid reviving it
                if (v && typeof v === 'object' && ('$mid' in v || v.scheme || v.path)) {
                    return '[Uri]';
                }
                return v;
            });
        } catch (e) {
            msgStr = String(message && message.command ? message.command : '[unserializable]');
        }
        console.log('[Extension] Received webview message:', msgStr);

        try {
            if (message && message.command === 'codeviz.ready') {
                console.log('[Extension] CodeViz webview is ready, flushing queue');
                globalCodeVizPanelReady = true;

                // Flush all queued messages using robust sender
                while (globalCodeVizMessageQueue.length > 0) {
                    const msg = globalCodeVizMessageQueue.shift();
                    try {
                        console.log('[Extension] Flushing queued message:', msg.command || '[unknown]');
                        sendMessageToCodeViz(msg);
                    } catch (postErr) {
                        console.error('[Extension] Failed to post queued message:', postErr);
                    }
                }
            } else if (message && message.command === 'codeviz.renderError') {
                console.error('[CodeViz] Webview render error:', message.error);
                vscode.window.showErrorMessage(`CodeViz rendering failed: ${message.error}`);
            } else if (message && (message.command === 'revealCode' || message.type === 'revealCode')) {
                try {
                    // message.start and message.end are character offsets into the source
                    const s = parseInt(message.start, 10);
                    const e = parseInt(message.end, 10);
                    if (!Number.isFinite(s) || !Number.isFinite(e)) {
                        console.warn('[Extension] revealCode with invalid offsets', message.start, message.end);
                    } else {
                        const active = vscode.window.activeTextEditor;
                        if (!active) {
                            console.warn('[Extension] revealCode: no active editor to reveal code in');
                        } else {
                            const doc = active.document;
                            const startPos = doc.positionAt(Math.max(0, s));
                            const endPos = doc.positionAt(Math.max(0, e));
                            vscode.window.showTextDocument(doc, { preview: false }).then(ed => {
                                try {
                                    ed.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
                                } catch (revealErr) {
                                    console.error('[Extension] revealCode revealRange error:', revealErr);
                                }
                            }).catch(showErr => {
                                console.error('[Extension] revealCode showTextDocument error:', showErr);
                            });
                        }
                    }
                } catch (rcErr) {
                    console.error('[Extension] revealCode handler error:', rcErr);
                }
            } else if (message && message.command === 'codeviz.unhandledMessage') {
                console.warn('[CodeViz] Unhandled webview message received');
            } else if (message && message.command === 'codeviz.vizLoadFailed') {
                console.error('[CodeViz] Viz library load failed:', message.detail);
                vscode.window.showErrorMessage(`CodeViz failed to load visualization library: ${message.detail}`);
            }
        } catch (handlerErr) {
            console.error('[Extension] Error handling webview message:', handlerErr);
        }
    });

    // Now set the HTML - webview is ready to receive messages
    try {
        panel.webview.html = html;
    } catch (err) {
        console.error('[Extension] Failed to set webview HTML:', err);
        // Show a friendly message to the user
        vscode.window.showErrorMessage('Failed to initialize CodeViz webview. See developer console for details.');
    }

    // Fallback: if the webview never posts a ready handshake, force-ready after a short timeout
    setTimeout(() => {
        if (!globalCodeVizPanelReady && globalCodeVizPanel) {
            console.warn('[Extension] Fallback: forcing CodeViz ready after timeout');
            globalCodeVizPanelReady = true;
            // Flush queued messages via robust sender
            while (globalCodeVizMessageQueue.length > 0) {
                const mq = globalCodeVizMessageQueue.shift();
                try { sendMessageToCodeViz(mq); } catch (err) { console.error('[Extension] Fallback flush error:', err); }
            }
        }
    }, 1500);
}

// --- PROFESSIONAL ANALYZER LOGIC ---
function analyzeFunctionAtCursor(text, cursorOffset) {
    const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: false, ranges: true });
    let targetNode = null;
    let targetName = 'anonymous';

    // Find function
    function find(node) {
        if (!node) return;
        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
            if (cursorOffset === 0 || (node.start <= cursorOffset && node.end >= cursorOffset)) {
                targetNode = node;
                if (node.id) targetName = node.id.name;
                else if (node.type === 'ArrowFunctionExpression') targetName = 'Arrow Fn';
                return;
            }
        }
        for (const k in node) {
            if (node[k] && typeof node[k] === 'object') {
                if (Array.isArray(node[k])) node[k].forEach(find);
                else find(node[k]);
                if (targetNode) return;
            }
        }
    }
    find(ast);
    if (!targetNode) throw new Error('No function found. Place cursor inside a function.');

    // Complexity Score
    let complexity = 1;
    function walk(n) {
        if (!n) return;
        if (['IfStatement', 'ForStatement', 'WhileStatement', 'DoWhileStatement', 'SwitchCase', 'CatchClause'].includes(n.type)) complexity++;
        if (n.type === 'LogicalExpression' || n.type === 'ConditionalExpression') complexity++;
        for (const k in n) {
            if (n[k] && typeof n[k] === 'object') {
                if (Array.isArray(n[k])) n[k].forEach(walk);
                else walk(n[k]);
            }
        }
    }
    walk(targetNode.body);

    // Generate Neat Graph (Polyline)
    const lines = [];
    lines.push('digraph G {');
    lines.push('  rankdir=TB; splines=polyline; nodesep=0.4; ranksep=0.5; bgcolor="transparent";');
    lines.push('  edge [fontname="Segoe UI", fontsize=10, color="#555", penwidth=1.2, arrowsize=0.8];');
    lines.push('  node [fontname="Segoe UI", fontsize=11, shape=box, style="filled,rounded", height=0.4, penwidth=1, color="#bbbbbb"];');

    lines.push(`  start [label="${targetName}", tooltip="Entry Point", shape=rect, fillcolor="#2e7d32", fontcolor="white", width=1.5];`);

    let idCounter = 0;
    const newId = (n) => `node_${idCounter++}|${n.start}|${n.end}`;
    const safe = (id) => `"${id}"`;
    const snippet = (n) => text.slice(n.start, n.end).split('\n')[0].trim().replace(/"/g, '\\"').slice(0, 20);

    function build(statements, parentId, incomingLabel = "") {
        let prev = parentId;
        let nextLabel = incomingLabel;

        for (const stmt of statements) {
            if (!stmt) continue;
            const edgeAttr = nextLabel ? ` [label="${nextLabel}"]` : "";
            nextLabel = "";

            if (stmt.type === 'IfStatement') {
                const id = newId(stmt.test);
                const cond = snippet(stmt.test);
                lines.push(`  ${safe(id)} [label="${cond} ?", shape=diamond, fillcolor="#fff8e1", color="#ffa000"];`);
                lines.push(`  ${safe(prev)} -> ${safe(id)}${edgeAttr};`);

                const thenEnd = buildBlock(stmt.consequent, id, 'Yes');
                let elseEnd = id;
                if (stmt.alternate) elseEnd = buildBlock(stmt.alternate, id, 'No');

                const merge = `merge_${idCounter++}`;
                lines.push(`  ${merge} [shape=point, width=0];`);

                const thenLbl = (thenEnd === id) ? ' [label="Yes"]' : '';
                const elseLbl = (elseEnd === id) ? ' [label="No"]' : '';

                lines.push(`  ${safe(thenEnd)} -> ${merge}${thenLbl};`);
                lines.push(`  ${safe(elseEnd)} -> ${merge}${elseLbl};`);
                prev = merge;

            } else if (['WhileStatement', 'ForStatement', 'DoWhileStatement'].includes(stmt.type)) {
                const id = newId(stmt);
                lines.push(`  ${safe(id)} [label="Loop", shape=hexagon, fillcolor="#e3f2fd", color="#1976d2"];`);
                lines.push(`  ${safe(prev)} -> ${safe(id)}${edgeAttr};`);

                const bodyEnd = buildBlock(stmt.body, id, 'Do');
                lines.push(`  ${safe(bodyEnd)} -> ${safe(id)} [constraint=false, style=dashed];`);

                const exit = `exit_${idCounter++}`;
                lines.push(`  ${exit} [shape=point, width=0];`);
                lines.push(`  ${safe(id)} -> ${exit} [label="Exit"];`);
                prev = exit;

            } else if (stmt.type === 'ReturnStatement') {
                const id = newId(stmt);
                lines.push(`  ${safe(id)} [label="Return", shape=ellipse, fillcolor="#c62828", fontcolor="white"];`);
                lines.push(`  ${safe(prev)} -> ${safe(id)}${edgeAttr};`);
                prev = id;

            } else if (stmt.type === 'BlockStatement') {
                prev = build(stmt.body.body, prev, edgeAttr);
            } else {
                const id = newId(stmt);
                let txt = snippet(stmt);
                let color = "#f5f5f5";
                if (txt.includes('console')) color = "#e1bee7"; // I/O
                lines.push(`  ${safe(id)} [label="${txt}", fillcolor="${color}"];`);
                lines.push(`  ${safe(prev)} -> ${safe(id)}${edgeAttr};`);
                prev = id;
            }
        }
        return prev;
    }

    function buildBlock(node, parent, lbl) {
        if (node.type === 'BlockStatement') return build(node.body, parent, lbl);
        return build([node], parent, lbl);
    }

    if (targetNode.body) {
        const body = targetNode.body.type === 'BlockStatement' ? targetNode.body.body : [targetNode.body];
        const end = build(body, 'start');
        lines.push(`  end [label="End", shape=rect, fillcolor="#c62828", fontcolor="white"];`);
        lines.push(`  ${safe(end)} -> end;`);
    }
    lines.push('}');

    return { dot: lines.join('\n'), complexity, funcName: targetName };
}

function activate(context) {
    // Start roadmap server automatically
    startRoadmapServer(context);

    // Providers
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("ez-coder.chatView", new EZCoderProvider(context)));

    // Commands
    context.subscriptions.push(vscode.commands.registerCommand("unified.openRoadmap", () => openRoadmapGenerator(context)));
    context.subscriptions.push(vscode.commands.registerCommand("unified.openCodeViz", () => openCodeVizPanel(context)));

    // Visualizer Command
    context.subscriptions.push(
        vscode.commands.registerCommand('unified.visualize', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('Open a JS/TS file and place cursor inside a function.');
                return;
            }

            const doc = editor.document;
            const selection = editor.selection;
            const textToAnalyze = doc.getText();
            const cursorOffset = doc.offsetAt(selection.active);

            // Ensure CodeViz panel is open
            if (!globalCodeVizPanel) {
                console.log('[Extension] CodeViz panel not open, opening now...');
                openCodeVizPanel(context);
                // Wait for webview to signal ready (with timeout)
                // We still allow the analysis to run; we'll wait below before sending
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            try {
                // Use Professional Analyzer
                console.log('[Extension] Analyzing function at cursor...');
                const analysis = analyzeFunctionAtCursor(textToAnalyze, cursorOffset);
                console.log('[Extension] Analysis complete for function:', analysis.funcName);

                const msg = {
                    command: 'renderGraph',
                    type: 'renderGraph', // Double support for legacy handler
                    dot: analysis.dot,
                    complexity: analysis.complexity,
                    funcName: analysis.funcName
                };

                // Wait up to 3s for CodeViz ready handshake before attempting to send
                const ready = await waitForCodeVizReady(3000);
                if (!ready) {
                    console.log('[Extension] ⏳ Webview did not signal ready in time, queueing renderGraph message for: ' + analysis.funcName);
                    globalCodeVizMessageQueue.push(msg);
                    try { vscode.window.showInformationMessage('Queued visualization: ' + analysis.funcName + ' (webview loading...)'); } catch (e) { }
                } else {
                    console.log('[Extension] ✅ Webview ready, sending renderGraph message for: ' + analysis.funcName);
                    sendMessageToCodeViz(msg);
                    try { vscode.window.showInformationMessage('Visualizing: ' + analysis.funcName); } catch (e) { }
                }
            } catch (e) {
                console.error('[Extension] ❌ Visualize error:', e);
                vscode.window.showErrorMessage('CodeViz Error: ' + e.message);
            }
        })
    );

    console.log("EZCoder Unified Extension activated!");
}

function deactivate() {
    if (globalRoadmapServer) {
        console.log('[Extension] Stopping roadmap server...');
        globalRoadmapServer.kill();
        globalRoadmapServer = null;
    }
}

// --- ROADMAP SERVER AUTO-START ---
function startRoadmapServer(context) {
    const serverPath = path.join(context.extensionPath, 'roadmap-generator', 'server');
    const serverFile = path.join(serverPath, 'index.js');

    if (!fs.existsSync(serverFile)) {
        console.warn('[Extension] Roadmap server not found at:', serverFile);
        return;
    }

    console.log('[Extension] Starting roadmap server from:', serverPath);

    try {
        globalRoadmapServer = spawn('node', ['index.js'], {
            cwd: serverPath,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Capture stdout
        globalRoadmapServer.stdout.on('data', (data) => {
            const message = `[Roadmap Server] ${data.toString().trim()}`;
            console.log(message);
        });

        // Capture stderr
        globalRoadmapServer.stderr.on('data', (data) => {
            const message = `[Roadmap Server] ERROR: ${data.toString().trim()}`;
            console.error(message);
        });

        // Handle process exit
        globalRoadmapServer.on('error', (err) => {
            console.error('[Extension] Failed to start roadmap server:', err.message);
            globalRoadmapServer = null;
        });

        globalRoadmapServer.on('exit', (code, signal) => {
            if (code !== 0 && code !== null) {
                console.warn(`[Extension] Roadmap server exited with code ${code}`);
            }
            globalRoadmapServer = null;
        });

        console.log('[Extension] Roadmap server started successfully');
    } catch (err) {
        console.error('[Extension] Error starting roadmap server:', err.message);
        globalRoadmapServer = null;
    }
}

module.exports = { activate, deactivate };