const fetch = require('node-fetch');

async function callEZCoderAPI(promptText) {
    const API_URL = "https://8000-gpu-t4-s-v1spi9044wf3-c.us-east1-2.prod.colab.dev/generate";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: promptText })
        });
        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("Error calling EZCoder API:", error);
        return "Error: Could not reach AI API.";
    }
}

module.exports = {
    callEZCoderAPI
};