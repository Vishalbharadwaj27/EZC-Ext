const fetch = require("node-fetch");
const vscode = require("vscode");

async function callEZCoderAPI(promptText) {
    const config = vscode.workspace.getConfiguration("ezcoder");
    let baseUrl = config.get("apiBase");

    if (!baseUrl) return "Error: API Base URL is not set.";

    // Ensure /generate endpoint
    if (!baseUrl.endsWith("/generate")) {
        baseUrl = baseUrl.replace(/\/$/, "") + "/generate";
    }

    try {
        const res = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: promptText,
               max_new_tokens: 256,
                temperature: 0.7,
                top_p: 0.9
            })
        });

        const data = await res.json();

        if (data.text) return data.text;

        return "Error: API returned no 'text' field.";
    } catch (err) {
        return "Error: Could not reach EZCoder API";
    }
}

module.exports = { callEZCoderAPI };
