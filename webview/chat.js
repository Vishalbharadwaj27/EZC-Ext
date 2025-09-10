/**
 * @type {() => {postMessage: (message: any) => void, getState: () => any, setState: (state: any) => void}}
 */
var acquireVsCodeApi;

// Get VS Code API
const vscode = acquireVsCodeApi();

// Elements
const messagesContainer = document.getElementById('messages');
const userInput = /** @type {HTMLInputElement} */ (document.getElementById('userInput'));
const sendButton = document.getElementById('sendMessage');
const apiKeyInput = /** @type {HTMLInputElement} */ (document.getElementById('apiKeyInput'));
const saveApiKeyButton = document.getElementById('saveApiKey');

// Initialize state
let messages = [];

// Restore previous state if it exists
const previousState = vscode.getState();
if (previousState) {
    messages = previousState.messages || [];
    renderMessages();
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);
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

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
        case 'addMessage':
            addMessage(message.text, message.isUser);
            break;
        case 'clearMessages':
            clearMessages();
            break;
    }
});

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

function addMessage(text, isUser) {
    messages.push({ text, isUser });
    vscode.setState({ messages });
    renderMessage({ text, isUser });
    scrollToBottom();
}

function renderMessage({ text, isUser }) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    // Check if the message contains code blocks
    const formattedText = text.replace(/```([\s\S]*?)```/g, (match, code) => {
        return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    });
    
    messageDiv.innerHTML = formattedText;
    messagesContainer.appendChild(messageDiv);
}

function renderMessages() {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => renderMessage(msg));
    scrollToBottom();
}

function clearMessages() {
    messages = [];
    vscode.setState({ messages });
    renderMessages();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
