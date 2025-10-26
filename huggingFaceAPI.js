const fetch = require('node-fetch');

class HuggingFaceAPI {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model; // This is still good to keep, even if not used in the URL
        
        // --- THIS IS THE UPDATED LINE ---
        // It now points to your personal Hugging Face Space URL
        this.baseUrl = `https://vishalbharadwaj-ezcoder-api.hf.space`;
        // ---------------------------------
    }

    async testConnection() {
        try {
            // This will now send a GET request to your Space's "/" (health check) endpoint
            const response = await fetch(this.baseUrl, {
                method: 'GET',
                headers: {
                    // Your API key is still needed to authorize with your private Space
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
            console.log('Preparing to send API request to your HF Space...');
            // This will now send a POST request to your Space's "/" (generate) endpoint
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
                // Check for the "model is loading" error
                if (errorBody.includes("is currently loading")) {
                    throw new Error("Model is loading, please try again in a moment.");
                }
                throw new Error(`API request failed: ${response.statusText}. Body: ${errorBody}`);
            }

            const data = await response.json();

            // The 'app.py' we wrote returns the data in the same format
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