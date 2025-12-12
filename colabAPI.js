const fetch = require("node-fetch");
const vscode = require("vscode");

async function callEZCoderAPI(promptText) {
    const config = vscode.workspace.getConfiguration("ezcoder");
    let baseUrl = config.get("apiBase");

    if (!baseUrl) return "Error: API Base URL is not set. Please configure 'ezcoder.apiBase' in workspace settings.";

    // Ensure /generate endpoint
    if (!baseUrl.endsWith("/generate")) {
        baseUrl = baseUrl.replace(/\/$/, "") + "/generate";
    }

    try {
        console.log("[EZCoderAPI] Sending prompt to API:", promptText.slice(0, 400));

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
        console.log("[EZCoderAPI] Raw API response:", data);

        // Handle multiple response shapes for API flexibility
        if (data.text) return data.text;
        if (data.choices && data.choices[0] && data.choices[0].text) return data.choices[0].text;
        if (data.output_text) return data.output_text;

        return `Error: Unexpected API response shape. Expected 'text', 'choices[0].text', or 'output_text' field. Got: ${JSON.stringify(data).slice(0, 1000)}`;
    } catch (err) {
        console.error("[EZCoderAPI] Network or parse error:", err);
        return `Error: Could not reach EZCoder API. Details: ${err.message}`;
    }
}

module.exports = { callEZCoderAPI };
