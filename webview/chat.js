// @ts-nocheck
/* global acquireVsCodeApi, document, window, navigator */
// @ts-check
/// <reference path="./globals.d.ts" />

(function() {
    // Get the vscode API
    const vscode = acquireVsCodeApi();

    /**
     * @typedef {Object} Message
     * @property {string} [text]
     * @property {boolean} isUser
     * @property {string} type
     * @property {string} [code]
     * @property {string} [explanation]
     * @property {string} [originalQuery]
     */

    /** @type {Message[]} */
    let messages = [];
    let lastSelectedLanguage = '';

    // Get the elements from the DOM
    /** @type {HTMLElement | null} */
    let messagesContainer = null;
    /** @type {HTMLTextAreaElement | null} */
    let userInput = null;
    /** @type {HTMLButtonElement | null} */
    let sendButton = null;
    /** @type {HTMLButtonElement | null} */
    let explainButton = null;
    /** @type {HTMLButtonElement | null} */
    let pseudocodeButton = null;
    /** @type {HTMLButtonElement | null} */
    let codeButton = null;
    /** @type {HTMLButtonElement | null} */
    let clearButton = null;
    /** @type {HTMLElement | null} */
    let thinking = null;
    /** @type {HTMLTemplateElement | null} */
    let langButtonsTemplate = null;

    /**
     * Initializes the elements from the DOM and restores the previous state if it exists.
     */
    function initializeElements() {
        messagesContainer = /** @type {HTMLElement} */ (document.getElementById('messages'));
        userInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('userInput'));
        sendButton = /** @type {HTMLButtonElement} */ (document.getElementById('sendButton'));
        explainButton = /** @type {HTMLButtonElement} */ (document.getElementById('explainButton'));
        pseudocodeButton = /** @type {HTMLButtonElement} */ (document.getElementById('pseudocodeButton'));
        codeButton = /** @type {HTMLButtonElement} */ (document.getElementById('codeButton'));
        clearButton = /** @type {HTMLButtonElement} */ (document.getElementById('clearButton'));
        thinking = /** @type {HTMLElement} */ (document.getElementById('thinking'));
        langButtonsTemplate = /** @type {HTMLTemplateElement} */ (document.getElementById('lang-buttons-template'));

        if (!messagesContainer || !userInput || !sendButton ||
            !explainButton || !pseudocodeButton || !codeButton || !clearButton || !thinking || !langButtonsTemplate) {
            throw new Error('Required elements not found in the document');
        }

        const previousState = vscode.getState();
        if (previousState) {
            messages = previousState.messages || [];
            lastSelectedLanguage = previousState.lastSelectedLanguage || '';
            renderMessages();
        }
    }

    /**
     * Sets up the event listeners for the elements.
     */
    function setupEventListeners() {
        if (!userInput || !sendButton || !explainButton || !pseudocodeButton || !codeButton || !clearButton || !messagesContainer) {
            return;
        }
        sendButton.addEventListener('click', () => sendMessage());

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        explainButton.addEventListener('click', () => handleActionButton('explain'));
        pseudocodeButton.addEventListener('click', () => handleActionButton('pseudocode'));
        codeButton.addEventListener('click', () => handleActionButton('code'));
        clearButton.addEventListener('click', () => clearMessages());

        messagesContainer.addEventListener('click', handleMessageClick);
        window.addEventListener('message', handleExtensionMessage);
    }

    /**
     * Handles clicks on the messages container.
     * @param {Event} event
     */
    function handleMessageClick(event) {
        const target = /** @type {HTMLElement} */ (event.target);

        if (target.id === 'verify-key-btn') {
            vscode.postMessage({ command: 'runVerification' });
            return;
        }

        if (target.classList.contains('lang-btn')) {
            handleLanguageSelection(event);
            return;
        }

        if (target.classList.contains('action-btn')) {
            const action = target.getAttribute('data-action');
            if (!action) return;

            const messageDiv = /** @type {HTMLElement | null} */ (target.closest('.ai-message'));
            if (!messageDiv) return;

            handleMessageAction(action, messageDiv);
            return;
        }

        if (target.classList.contains('copy-btn')) {
            const pre = target.nextElementSibling;
            if (pre && pre.tagName === 'PRE') {
                const code = pre.querySelector('code');
                if (code) {
                    navigator.clipboard.writeText(code.innerText);
                    target.textContent = 'Copied!';
                    setTimeout(() => {
                        target.textContent = 'Copy';
                    }, 2000);
                }
            }
        }
    }

    /**
     * Handles actions on the messages.
     * @param {string} action
     * @param {HTMLElement} messageDiv
     */
    function handleMessageAction(action, messageDiv) {
        const query = messageDiv.getAttribute('data-query');
        if (!query) return;

        if (action === 'code') {
            const message = { type: 'lang-select', originalQuery: query, isUser: false };
            messages.push(message);
            renderMessages();
        } else if (action === 'pseudocode') {
            showThinking();
            vscode.postMessage({
                command: 'generatePseudocode',
                concept: query
            });
        }
    }

    /**
     * Handles the language selection.
     * @param {Event} e
     */
    function handleLanguageSelection(e) {
        const target = /** @type {HTMLElement} */ (e.target);
        if (!target.classList.contains('lang-btn')) return;

        const language = target.getAttribute('data-lang');
        if (!language) return;

        const messageDiv = target.closest('.ai-message');
        if (!messageDiv) return;

        const query = messageDiv.getAttribute('data-query');
        if (!query) return;

        lastSelectedLanguage = language;
        vscode.setState({ messages, lastSelectedLanguage });

        messages.pop();
        showThinking();
        vscode.postMessage({
            command: 'generateCode',
            concept: query,
            language: language
        });
    }

    /**
     * Handles messages from the extension.
     * @param {MessageEvent} event
     */
    function handleExtensionMessage(event) {
        const message = event.data;
        hideThinking();

        switch (message.command) {
            case 'addMessage':
                addMessage(message.text, message.isUser);
                break;
            case 'updateLastMessage':
                updateLastMessage(message.text);
                break;
            case 'addCode':
                addCode(message.code);
                break;
            case 'addExplanation':
                addExplanation(message.explanation, message.originalQuery, message.isUser);
                break;
            case 'clearChat':
                clearMessages();
                break;
        }
    }

    /**
     * Sends a message to the extension.
     */
    function sendMessage() {
        if (!userInput) return;
        const text = userInput.value.trim();
        if (text) {
            addMessage(text, true);
            showThinking();
            vscode.postMessage({
                command: 'sendMessage',
                text: text
            });
            userInput.value = '';
        }
    }

    /**
     * Handles the action buttons.
     * @param {string} action
     */
    function handleActionButton(action) {
        if (!userInput) return;
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, true);
        showThinking();
        vscode.postMessage({
            command: 'sendMessage',
            text: text,
            action: action
        });
        userInput.value = '';
    }

    /**
     * Adds a message to the chat.
     * @param {string} text
     * @param {boolean} isUser
     */
    function addMessage(text, isUser) {
        const message = { text, isUser, type: 'normal' };
        messages.push(message);
        vscode.setState({ messages, lastSelectedLanguage });
        renderMessages();
    }

    /**
     * Adds an explanation to the chat.
     * @param {string} explanation
     * @param {string} originalQuery
     * @param {boolean} isUser
     */
    function addExplanation(explanation, originalQuery, isUser) {
        const message = { explanation, originalQuery, isUser, type: 'explanation' };
        messages.push(message);
        vscode.setState({ messages, lastSelectedLanguage });
        renderMessages();
    }

    /**
     * Adds code to the chat.
     * @param {string} code
     * @param {boolean} isUser
     */
    function addCode(code, isUser = false) {
        const message = { code, isUser, type: 'code' };
        messages.push(message);
        vscode.setState({ messages, lastSelectedLanguage });
        renderMessages();
    }

    /**
     * Updates the last message in the chat.
     * @param {string} text
     */
    function updateLastMessage(text) {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.type === 'normal' && !lastMessage.isUser) {
                lastMessage.text = text;
            }
            renderMessages();
        }
    }

    /**
     * Renders the messages in the chat.
     */
    function renderMessages() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            if (msg.type === 'explanation' && msg.explanation && msg.originalQuery) {
                renderExplanationMessage(msg.explanation, msg.originalQuery);
            } else if (msg.type === 'normal' && msg.text !== undefined) {
                renderMessage(msg.text, msg.isUser);
            } else if (msg.type === 'code' && msg.code) {
                renderCodeMessage(msg.code, msg.isUser);
            } else if (msg.type === 'lang-select' && msg.originalQuery) {
                renderLangSelectMessage(msg.originalQuery);
            }
        });
        scrollToBottom();
    }

    /**
     * Renders a message in the chat.
     * @param {string} text
     * @param {boolean} isUser
     */
    function renderMessage(text, isUser) {
        if (!messagesContainer) return;
        const div = document.createElement('div');
        div.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        div.textContent = text;
        messagesContainer.appendChild(div);
    }

    /**
     * Renders a code message in the chat.
     * @param {string} code
     * @param {boolean} isUser
     */
    function renderCodeMessage(code, isUser) {
        if (!messagesContainer) return;
        const div = document.createElement('div');
        div.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        div.appendChild(copyBtn);

        const pre = document.createElement('pre');
        const codeEl = document.createElement('code');
        codeEl.textContent = code;
        pre.appendChild(codeEl);
        div.appendChild(pre);
        messagesContainer.appendChild(div);
    }

    /**
     * Renders an explanation message in the chat.
     * @param {string} explanation
     * @param {string} originalQuery
     */
    function renderExplanationMessage(explanation, originalQuery) {
        if (!messagesContainer) return;
        const div = document.createElement('div');
        div.className = 'message ai-message';
        div.setAttribute('data-query', originalQuery);

        const explanationDiv = document.createElement('div');
        explanationDiv.className = 'explanation';
        explanationDiv.textContent = explanation;
        div.appendChild(explanationDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'explanation-actions';

        const pseudocodeBtn = document.createElement('button');
        pseudocodeBtn.className = 'action-btn';
        pseudocodeBtn.setAttribute('data-action', 'pseudocode');
        pseudocodeBtn.textContent = 'Generate Pseudocode';

        const codeBtn = document.createElement('button');
        codeBtn.className = 'action-btn';
        codeBtn.setAttribute('data-action', 'code');
        codeBtn.textContent = 'Generate Code';

        actionsDiv.appendChild(pseudocodeBtn);
        actionsDiv.appendChild(codeBtn);
        div.appendChild(actionsDiv);

        messagesContainer.appendChild(div);
    }

    /**
     * Renders a language select message in the chat.
     * @param {string} originalQuery
     */
    function renderLangSelectMessage(originalQuery) {
        if (!messagesContainer || !langButtonsTemplate) return;
        const div = document.createElement('div');
        div.className = 'message ai-message';
        div.setAttribute('data-query', originalQuery);

        const langButtonsClone = langButtonsTemplate.content.cloneNode(true);
        div.appendChild(langButtonsClone);

        messagesContainer.appendChild(div);
    }

    /**
     * Clears the messages in the chat.
     */
    function clearMessages() {
        messages = [];
        lastSelectedLanguage = '';
        vscode.setState({ messages, lastSelectedLanguage });
        renderMessages();
    }

    /**
     * Scrolls to the bottom of the chat.
     */
    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    /**
     * Shows the thinking indicator.
     */
    function showThinking() {
        if (thinking) {
            thinking.style.display = 'block';
            thinking.style.opacity = '1';
        }
    }

    /**
     * Hides the thinking indicator.
     */
    function hideThinking() {
        if (thinking) {
            thinking.style.opacity = '0';
            setTimeout(() => {
                thinking.style.display = 'none';
            }, 500);
        }
    }

    // Initialize the script
    initializeElements();
    setupEventListeners();
})();
