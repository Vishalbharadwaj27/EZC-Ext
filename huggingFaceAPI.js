const fetch = require('node-fetch');

const fs = require('fs');
let API_URL = "";

try {
    API_URL = fs.readFileSync(__dirname + "/colab_url.txt", "utf8").trim();
} catch (e) {
    console.log("No Colab URL found.");
}


class HuggingFaceAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // The 'model' and 'baseUrl' parameters are no longer needed
    }

    async testConnection() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: 'test',
                }),
            });

            return {
                success: response.ok,
                statusCode: response.status,
            };
        } catch (error) {
            return {
                success: false,
                statusCode: 0, // Or some other indicator of a network error
            };
        }
    }

    async chat(inputs) {
        try {
            console.log('Sending API request to Serverless Inference API...');
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    // Your API key is now used for authorization
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: inputs,
                    parameters: {
                        max_new_tokens: 1024,
                        return_full_text: false,
                    },
                    options: {
                        // This tells the API to wait for the model to load
                        // (this is what handles the "cold start")
                        wait_for_model: true
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                // Check for the "model is loading" error
                if (errorBody.includes("is currently loading")) {
                    // This is a "cold start", tell the user to wait
                    throw new Error("Model is loading, please try again in a moment.");
                }
                throw new Error(`API request failed: ${response.statusText}. Body: ${errorBody}`);
            }

            const data = await response.json();

            // The data format is the same as before
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
    
    // This function can also be updated to use the new `chat` method
    async completeCode(context, prompt) {
        const inputs = `Context:\n${context}\n\nRequest: ${prompt}`;
        return this.chat(inputs);
    }
}

module.exports = HuggingFaceAPI;