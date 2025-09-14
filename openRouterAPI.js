const fetch = require('node-fetch');

class OpenRouterAPI {
    /**
     * @param {string} apiKey 
     */
    constructor(apiKey) {
        if (!apiKey) {
            // This error will be caught by the calling function and displayed to the user.
            // This is better than silently failing or using a potentially undefined key.
            throw new Error('API key is required.');
        }
        this.apiKey = apiKey;
        this.baseUrl = 'https://openrouter.ai/api/v1';
    }

    async chat(messages) {
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/Vishalbharadwaj27/EZC-Ext' // Replace with your app's URL
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