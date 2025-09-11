const fetch = require('node-fetch');

class OpenRouterAPI {
    /**
     * @param {string} apiKey 
     */
    constructor(apiKey) {
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
                    // It's good practice to identify your app in the referer header
                    'HTTP-Referer': 'https://github.com/Vishalbharadwaj27/EZC-Ext'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4', // or any other model you prefer
                    messages: messages
                })
            });

            if (!response.ok) {
                // It's helpful to log the response body for more detailed error info
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
            // Re-throwing the error so the calling function can handle it
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