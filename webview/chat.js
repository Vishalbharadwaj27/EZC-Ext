// @ts-nocheck
/* global acquireVsCodeApi, document, window, navigator */

(function () {
    // Graceful acquire of VS Code API for webview. If not available (standalone/dev), vscode will be null.
    const vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;

    let messages = [];
    let lastSelectedLanguage = "";
    let elements = {};

    function init() {
        queryElements();
        restoreState();
        registerEvents();
        renderMessages();
    }

    function queryElements() {
        elements = {
            messages: document.getElementById("messages"),
            input: document.getElementById("userInput"),
            send: document.getElementById("sendButton"),
            pseudocode: document.getElementById("pseudocodeButton"),
            code: document.getElementById("codeButton"),
            clear: document.getElementById("clearButton"),
            thinking: document.getElementById("thinking"),
            langTemplate: document.getElementById("lang-buttons-template")
        };

        // Only require core UI elements — roadmap button moved to header and wired separately.
        const required = ['messages','input','send','pseudocode','code','clear','thinking','langTemplate'];
        for (const k of required) {
            if (!elements[k]) throw new Error(`Missing DOM element: ${k}`);
        }
    }

    function restoreState() {
        // Guard when vscode API is not available (dev preview or standalone)
        if (!vscode || typeof vscode.getState !== 'function') return;
        const state = vscode.getState();
        if (!state) return;
        messages = state.messages || [];
        lastSelectedLanguage = state.lastSelectedLanguage || "";
    }

    function registerEvents() {
        elements.send.addEventListener("click", sendUserMessage);

        elements.input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendUserMessage();
            }
        });

        elements.pseudocode.addEventListener("click", () =>
            handleAction("pseudocode")
        );

        elements.code.addEventListener("click", () =>
            handleAction("code")
        );

        // Wire the new top-left Roadmap button. If VS Code API is not available, toggle an iframe overlay.
        const openRoadmapBtn = document.getElementById('open-roadmap-btn');
        if (openRoadmapBtn) {
            openRoadmapBtn.addEventListener('click', () => {
                const msg = { command: 'open.roadmap' };
                // If VS Code API is available, post a dual message: open.roadmap and an executeCommand request.
                if (vscode) {
                    try {
                        vscode.postMessage(msg);
                        // Also request the host to execute the registered command 'unified.openRoadmap' as a fallback
                        vscode.postMessage({ command: 'executeCommand', commandToRun: 'unified.openRoadmap' });
                    } catch (e) {
                        // if posting fails, fallback to overlay
                        toggleRoadmapOverlay();
                    }
                } else {
                    // Fallback: toggle embedded iframe overlay and broadcast message
                    toggleRoadmapOverlay();
                    window.postMessage(msg, '*');
                }
            });
        }

        elements.clear.addEventListener("click", clearMessages);
        elements.messages.addEventListener("click", handleMessageClick);
        window.addEventListener("message", handleExtensionMessage);
    }

    // Create a small iframe overlay for local preview when VS Code API isn't available.
    function toggleRoadmapOverlay(){
        const existing = document.querySelector('.rg-iframe-overlay');
        if(existing){ existing.remove(); return; }

        const overlay = document.createElement('div');
        overlay.className = 'rg-iframe-overlay';
        overlay.style.left = '32px'; overlay.style.top = '32px'; overlay.style.right = '32px'; overlay.style.bottom = '32px';

        const close = document.createElement('button');
        close.className = 'rg-iframe-close';
        close.textContent = 'Close';
        close.addEventListener('click', ()=> overlay.remove());

        const iframe = document.createElement('iframe');
        // Try to load the roadmap generator URL relative to extension files. May work in dev preview.
        iframe.src = './roadmap-generator/webview/index.html';
        overlay.appendChild(close);
        overlay.appendChild(iframe);
        document.body.appendChild(overlay);
    }

    function sendUserMessage() {
        const text = elements.input.value.trim();
        if (!text) return;

        addMessage(text, true);
        elements.input.value = "";
        showThinking();

        const msg = { command: "sendMessage", text };
        if (vscode) vscode.postMessage(msg);
        else window.postMessage(msg, '*');
    }

    function handleAction(action) {
        const text = elements.input.value.trim();
        if (!text) return;

        addMessage(text, true);
        elements.input.value = "";

        if (action === "pseudocode") {
            showThinking();
            const msg = { command: "generatePseudocode", concept: text };
            if (vscode) vscode.postMessage(msg); else window.postMessage(msg, '*');
        }

        if (action === "code") {
            addLangSelectNode(text);
        }
    }

    function handleMessageClick(e) {
        const t = e.target;

        if (t.classList.contains("copy-btn")) return copyCode(t);

        if (t.classList.contains("action-btn"))
            return handleAIAction(t.dataset.action, t.closest(".ai-message"));

        if (t.classList.contains("lang-btn"))
            return handleLangSelect(t);
    }

    function copyCode(btn) {
        const code = btn.nextElementSibling?.querySelector("code");
        if (!code) return;
        navigator.clipboard.writeText(code.innerText);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
    }

    function handleAIAction(action, div) {
        const q = div.getAttribute("data-query");
        if (!q) return;

        if (action === "pseudocode") {
            showThinking();
                const msg = { command: "generatePseudocode", concept: q };
                if (vscode) vscode.postMessage(msg); else window.postMessage(msg, '*');
        }

        if (action === "code") addLangSelectNode(q);
    }

    function addLangSelectNode(query) {
        messages.push({ type: "lang-select", query });
        saveState();
        renderMessages();
    }

    function handleLangSelect(btn) {
        const lang = btn.dataset.lang;
        const wrapper = btn.closest(".ai-message");
        const query = wrapper.getAttribute("data-query");

        lastSelectedLanguage = lang;
        messages.pop();

        showThinking();
        saveState();
        const msg = { command: "generateCode", concept: query, language: lang };
        if (vscode) vscode.postMessage(msg); else window.postMessage(msg, '*');
    }

    function handleExtensionMessage(event) {
        const msg = event.data;
        hideThinking();

        if (msg.command === "addMessage")
            return addMessage(msg.text, msg.isUser);

        if (msg.command === "addExplanation")
            return addExplanation(msg.explanation, msg.originalQuery);

        if (msg.command === "addCode")
            return addCode(msg.code);

        if (msg.command === "clearChat")
            return clearMessages();
        // Support opening the roadmap view if host asks
        if (msg.command === 'open.roadmap'){
            // If host sent this to the chat webview, open overlay fallback
            if (typeof acquireVsCodeApi !== 'function') toggleRoadmapOverlay();
            return;
        }
    }

    function addMessage(text, isUser) {
        messages.push({ type: "text", text, isUser });
        saveState();
        renderMessages();
    }

    function addExplanation(info, query) {
        messages.push({ type: "explanation", query, text: info });
        saveState();
        renderMessages();
    }

    function addCode(code) {
        messages.push({ type: "code", code });
        saveState();
        renderMessages();
    }

    function clearMessages() {
        messages = [];
        lastSelLang = "";
        saveState();
        renderMessages();
    }

    function renderMessages() {
        const root = elements.messages;
        root.innerHTML = "";

        for (const msg of messages) {
            if (msg.type === "text") renderTextMessage(msg);
            if (msg.type === "explanation") renderExplanation(msg);
            if (msg.type === "code") renderCode(msg);
            if (msg.type === "lang-select") renderLangSelect(msg);
        }

        root.scrollTop = root.scrollHeight;
    }

    function renderTextMessage(msg) {
        const d = document.createElement("div");
        d.className = `message ${msg.isUser ? "user-message" : "ai-message"}`;
        d.textContent = msg.text;
        elements.messages.appendChild(d);
    }

    function renderExplanation(msg) {
        const d = document.createElement("div");
        d.className = "message ai-message";
        d.setAttribute("data-query", msg.query);

        const t = document.createElement("div");
        t.className = "explanation";
        t.textContent = msg.text;

        const actions = document.createElement("div");
        actions.className = "explanation-actions";

        const p = document.createElement("button");
        p.className = "action-btn";
        p.textContent = "Generate Pseudocode";
        p.dataset.action = "pseudocode";

        const c = document.createElement("button");
        c.className = "action-btn";
        c.textContent = "Generate Code";
        c.dataset.action = "code";

        actions.appendChild(p);
        actions.appendChild(c);

        d.appendChild(t);
        d.appendChild(actions);

        elements.messages.appendChild(d);
    }

    function renderCode(msg) {
        const d = document.createElement("div");
        d.className = "message ai-message";

        const btn = document.createElement("button");
        btn.className = "copy-btn";
        btn.textContent = "Copy";

        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = msg.code;

        pre.appendChild(code);
        d.appendChild(btn);
        d.appendChild(pre);

        elements.messages.appendChild(d);
    }

    function renderLangSelect(msg) {
        const d = document.createElement("div");
        d.className = "message ai-message";
        d.setAttribute("data-query", msg.query);

        const clone = elements.langTemplate.content.cloneNode(true);
        d.appendChild(clone);

        elements.messages.appendChild(d);
    }

    function showThinking() {
        elements.thinking.style.display = "block";
        elements.thinking.style.opacity = "1";
    }

    function hideThinking() {
        elements.thinking.style.opacity = "0";
        setTimeout(() => {
            elements.thinking.style.display = "none";
        }, 200);
    }

    function saveState() {
        if (!vscode || typeof vscode.setState !== 'function') return;
        vscode.setState({ messages, lastSelectedLanguage });
    }

    init();
})();
