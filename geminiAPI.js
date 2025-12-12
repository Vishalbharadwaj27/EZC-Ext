/**
 * geminiAPI.js - Google Generative Language (PaLM) API client for Roadmap Generation
 * Separate from EZCoder API to allow independent configuration and API routing
 */

const fetch = require('node-fetch');
const vscode = require('vscode');

/**
 * Call Google Gemini/PaLM API for text generation
 * @param {string} promptText - The prompt to send
 * @param {string} model - Optional model override (e.g., 'text-bison-001')
 * @returns {Promise<{text?: string, error?: string, raw?: any}>}
 */
async function callGeminiAPI(promptText, model = null) {
    const config = vscode.workspace.getConfiguration('ezcoder');
    const apiKey = config.get('geminiApiKey');
    const modelName = model || config.get('geminiModel') || 'text-bison-001';

    if (!apiKey) {
        const msg = 'Gemini API key not configured. Please set ezcoder.geminiApiKey in workspace settings.';
        console.error('[GeminiAPI] ' + msg);
        return { error: msg };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta2/models/${modelName}:generateText?key=${apiKey}`;

    const body = {
        prompt: { text: promptText },
        temperature: 0.2,
        maxOutputTokens: 1500
    };

    console.log('[GeminiAPI] Sending request to model:', modelName);
    console.log('[GeminiAPI] Prompt (first 300 chars):', promptText.slice(0, 300));

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        // Check content-type before parsing JSON to avoid HTML error pages
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const raw = await res.text();
            console.error('[GeminiAPI] Unexpected content-type:', contentType);
            console.error('[GeminiAPI] Response starts with:', raw.slice(0, 300));
            const msg = 'API returned non-JSON content. Status: ' + res.status + '. Content-Type: ' + contentType + '. Make sure the API endpoint is correct and the key is valid.';
            return { error: msg };
        }

        // Parse JSON response
        let data;
        try {
            data = await res.json();
        } catch (parseErr) {
            console.error('[GeminiAPI] JSON parse error:', parseErr);
            const msg = 'Failed to parse API response as JSON: ' + parseErr.message;
            return { error: msg };
        }

        console.log('[GeminiAPI] Raw response structure:', JSON.stringify(data).slice(0, 1500));

        // Handle multiple response shapes from Gemini API
        // Latest format (v1beta2):
        if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
            if (data.candidates[0].output) {
                return { text: data.candidates[0].output };
            }
        }

        // Alternative format with content:
        if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
            if (data.candidates[0].content) {
                return { text: data.candidates[0].content };
            }
        }

        // Fallback formats:
        if (data.output && typeof data.output === 'string') {
            return { text: data.output };
        }
        if (data.text && typeof data.text === 'string') {
            return { text: data.text };
        }

        // If we got an error message in the response
        if (data.error) {
            console.error('[GeminiAPI] API returned error:', data.error);
            const errMsg = data.error.message || JSON.stringify(data.error);
            return { error: 'Gemini API error: ' + errMsg };
        }

        // Unexpected shape
        console.error('[GeminiAPI] Unexpected response structure, could not extract text');
        const msg = 'Unexpected API response shape. Expected candidates[0].output or similar.';
        return { error: msg, raw: data };

    } catch (err) {
        console.error('[GeminiAPI] Network or request error:', err);
        const msg = 'Could not reach Gemini API: ' + err.message;
        return { error: msg };
    }
}

module.exports = { callGeminiAPI };
