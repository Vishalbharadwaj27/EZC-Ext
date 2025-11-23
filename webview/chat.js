// @ts-nocheck
/* global acquireVsCodeApi, document, window, navigator */

(function () {
    const vscode = acquireVsCodeApi();

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

        for (const k in elements) {
            if (!elements[k]) throw new Error(`Missing DOM element: ${k}`);
        }
    }

    function restoreState() {
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

        elements.clear.addEventListener("click", clearMessages);
        elements.messages.addEventListener("click", handleMessageClick);
        window.addEventListener("message", handleExtensionMessage);
    }

    function sendUserMessage() {
        const text = elements.input.value.trim();
        if (!text) return;

        addMessage(text, true);
        elements.input.value = "";
        showThinking();

        vscode.postMessage({ command: "sendMessage", text });
    }

    function handleAction(action) {
        const text = elements.input.value.trim();
        if (!text) return;

        addMessage(text, true);
        elements.input.value = "";

        if (action === "pseudocode") {
            showThinking();
            vscode.postMessage({
                command: "generatePseudocode",
                concept: text
            });
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
            vscode.postMessage({
                command: "generatePseudocode",
                concept: q
            });
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

        vscode.postMessage({
            command: "generateCode",
            concept: query,
            language: lang
        });
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
        vscode.setState({ messages, lastSelectedLanguage });
    }

    init();
})();
