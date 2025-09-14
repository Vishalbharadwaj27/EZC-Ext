/**
 * @type {() => {postMessage: (message: any) => void, getState: () => any, setState: (state: any) => void}}
 */
var acquireVsCodeApi;

// Get VS Code API
const vscode = acquireVsCodeApi();

// State type definition
/** @type {Array<{text?: string, isUser: boolean, type: string, explanation?: string, originalQuery?: string, code?: string}>} */
let messages = [];
let lastSelectedLanguage = null;

// Initialize after DOM is loaded
(function() {
    // Wait for DOM to be ready
    if (typeof document === 'undefined') {
        throw new Error('Document is not available');
    }

    // Elements
    const messagesContainer = /** @type {HTMLElement} */ (document.getElementById('messages'));
    const userInput = /** @type {HTMLInputElement} */ (document.getElementById('userInput'));
    const sendButton = /** @type {HTMLButtonElement} */ (document.getElementById('sendButton'));
    const apiKeyInput = /** @type {HTMLInputElement} */ (document.getElementById('apiKeyInput'));
    const saveApiKeyButton = /** @type {HTMLButtonElement} */ (document.getElementById('saveApiKey'));
    const explainButton = /** @type {HTMLButtonElement} */ (document.getElementById('explainButton'));
    const pseudocodeButton = /** @type {HTMLButtonElement} */ (document.getElementById('pseudocodeButton'));
    const codeButton = /** @type {HTMLButtonElement} */ (document.getElementById('codeButton'));

    // Template
    const langButtonsTemplate = /** @type {HTMLTemplateElement} */ (document.getElementById('lang-buttons-template'));

    if (!messagesContainer || !userInput || !sendButton || !apiKeyInput || !saveApiKeyButton || 
        !explainButton || !pseudocodeButton || !codeButton || !langButtonsTemplate) {
        throw new Error('Required elements not found in the document');
    }

    // Restore previous state if it exists
    const previousState = vscode.getState();
    if (previousState) {
        messages = previousState.messages || [];
        lastSelectedLanguage = previousState.lastSelectedLanguage || null;
        renderMessages();
    }

    // Event Listeners
    sendButton.addEventListener('click', () => sendMessage());

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    saveApiKeyButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            vscode.postMessage({
                command: 'saveApiKey',
                apiKey: apiKey
            });
            apiKeyInput.value = '';
        }
    });

    // Handle button clicks within messages
    messagesContainer.addEventListener('click', handleMessageClick);

    // Handle messages from extension
    window.addEventListener('message', handleExtensionMessage);

    function handleMessageClick(event) {
        const target = /** @type {HTMLElement} */ (event.target);
        if (!target.classList.contains('action-btn')) return;

        const action = target.getAttribute('data-action');
        if (!action) return;

        const messageDiv = target.closest('.ai-message');
        if (!messageDiv) return;

        handleMessageAction(action, messageDiv, target);
    }

    function handleMessageAction(action, messageDiv, target) {
        if (action === 'code') {
            const clone = langButtonsTemplate.content.cloneNode(true);
            const parent = target.parentElement;
            if (parent) parent.replaceWith(clone);

            const buttonsContainer = messageDiv.querySelector('.lang-buttons');
            if (!buttonsContainer) return;

            buttonsContainer.addEventListener('click', handleLanguageSelection);
        } else if (action === 'pseudocode') {
            const query = messageDiv.getAttribute('data-query');
            if (query) {
                vscode.postMessage({
                    command: 'generatePseudocode',
                    concept: query
                });
            }
        }
    }

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

        vscode.postMessage({
            command: 'generateCode',
            concept: query,
            language: language
        });

        const buttonsContainer = target.closest('.lang-buttons');
        if (buttonsContainer) buttonsContainer.remove();
    }

    function handleExtensionMessage(event) {
        const message = event.data;

        switch (message.command) {
            case 'addMessage':
                addMessage(message.text, message.isUser);
                break;
            case 'addExplanation':
                addExplanation(message.explanation, message.originalQuery, message.isUser);
                break;
            case 'addCode':
                addCode(message.code);
                break;
            case 'clearMessages':
                clearMessages();
                break;
        }
    }

    function sendMessage() {
        const text = userInput.value.trim();
        if (text) {
            vscode.postMessage({
                command: 'sendMessage',
                text: text
            });
            userInput.value = '';
        }
    }

    function handleActionButton(action) {
        const text = userInput.value.trim();
        if (!text) return;
        
        vscode.postMessage({
            command: 'sendMessage',
            text: text,
            action: action
        });
        userInput.value = '';
    }

    function addMessage(text, isUser) {
        const message = { text, isUser, type: 'normal' };
        messages.push(message);
        vscode.setState({ messages, lastSelectedLanguage });
        renderMessage(text, isUser);
        scrollToBottom();
    }

    function addExplanation(explanation, originalQuery, isUser) {
        const message = { explanation, originalQuery, isUser, type: 'explanation' };
        messages.push(message);
        vscode.setState({ messages, lastSelectedLanguage });
        renderExplanationMessage(explanation, originalQuery);
        scrollToBottom();
    }

    function addCode(code) {
        const explanationMessage = messages.slice().reverse().find(m => m.type === 'explanation' && !m.code);
        if (explanationMessage) {
            explanationMessage.code = code;
            vscode.setState({ messages, lastSelectedLanguage });
            renderMessages();
        }
    }

    function renderMessage(text, isUser) {
        const div = document.createElement('div');
        div.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        div.textContent = text;
        messagesContainer.appendChild(div);
    }

    function renderExplanationMessage(explanation, originalQuery) {
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

    function renderMessages() {
        messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            if (msg.type === 'explanation' && msg.explanation && msg.originalQuery) {
                renderExplanationMessage(msg.explanation, msg.originalQuery);
                if (msg.code) {
                    const pre = document.createElement('pre');
                    const code = document.createElement('code');
                    code.textContent = msg.code;
                    pre.appendChild(code);
                    const lastMessage = messagesContainer.lastElementChild;
                    if (lastMessage) {
                        lastMessage.appendChild(pre);
                    }
                }
            } else if (msg.type === 'normal' && msg.text !== undefined) {
                renderMessage(msg.text, msg.isUser);
            }
        });
        scrollToBottom();
    }

    function clearMessages() {
        messages = [];
        lastSelectedLanguage = null;
        vscode.setState({ messages, lastSelectedLanguage });
        renderMessages();
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
})();
