const fetch = require('node-fetch');

class OpenRouterAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://openrouter.ai/api/v1';
    }

    async testConnection() {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'https://github.com/Vishalbharadwaj27/EZC-Ext'
                }
            });

            if (response.ok) { // response.ok is true for statuses in the range 200-299
                return { success: true, statusCode: response.status };
            } else {
                return { success: false, statusCode: response.status };
            }
        } catch (error) {
            console.error('API connection test failed:', error);
            return { success: false, error: error.message };
        }
    }

    async chat(messages) {
        try {
            console.log('Preparing to send API request...');
            console.log('Using API Key:', this.apiKey ? `sk-or-...${this.apiKey.slice(-4)}` : 'API Key is missing or invalid!');
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    // IMPORTANT: Replace this with your actual extension's website or GitHub repository URL.
                    // This is required by the OpenRouter API.
                    'HTTP-Referer': 'https://github.com/Vishalbharadwaj27/EZC-Ext'
                },
                body: JSON.stringify({
                    model: 'mistralai/mistral-7b-instruct', // Using a reliable free model
                    messages: messages,
                    max_tokens: 1024 // Added to prevent long responses and potential credit issues
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API request failed: ${response.statusText}. Body: ${errorBody}`);
            }

            const data = /** @type {any} */ (await response.json());

            if (data && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                return data.choices[0].message.content;
            } else {
                throw new Error('Invalid response format from OpenRouter API');
            }
        } catch (error) {
            console.error('OpenRouter API Error:', error);
            throw error;
        }
    }

    async completeCode(context, prompt) {
        const messages = [
            {
                role: 'system',
                content: 'You are an expert programming assistant. Analyze the code context and generate appropriate code based on the user\'s request.'
            },
            {
                role: 'user',
                content: `Context:\n${context}\n\nRequest: ${prompt}`
            }
        ];

        return this.chat(messages);
    }
}

module.exports = OpenRouterAPI;
