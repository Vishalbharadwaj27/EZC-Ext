const fetch = require('node-fetch');

class HuggingFaceAPI {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = `https://api-inference.huggingface.co/models/${model}`;
    }

    async testConnection() {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                }
            });

            if (response.ok) {
                return { success: true, statusCode: response.status };
            } else {
                return { success: false, statusCode: response.status };
            }
        } catch (error) {
            console.error('API connection test failed:', error);
            return { success: false, error: error.message };
        }
    }

    async chat(inputs) {
        try {
            console.log('Preparing to send API request to Hugging Face...');
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: inputs,
                    parameters: {
                        max_new_tokens: 1024,
                        return_full_text: false,
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API request failed: ${response.statusText}. Body: ${errorBody}`);
            }

            const data = await response.json();

            if (data && data[0] && data[0].generated_text) {
                return data[0].generated_text;
            } else {
                throw new Error('Invalid response format from Hugging Face API');
            }
        } catch (error) {
            console.error('Hugging Face API Error:', error);
            throw error;
        }
    }

    async completeCode(context, prompt) {
        const inputs = `Context:\n${context}\n\nRequest: ${prompt}`;
        return this.chat(inputs);
    }
}

module.exports = HuggingFaceAPI;