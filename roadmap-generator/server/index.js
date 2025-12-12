import express from "express";
import cors from "cors";
import axios from "axios";
// Load .env only in non-production (keeps production/published extension safe)
import dotenv from "dotenv";
if (process.env.NODE_ENV !== 'production') {
  try { dotenv.config(); } catch (e) { /* ignore */ }
}

const app = express();
app.use(cors());
app.use(express.json());

// Use config helper to get GEMINI API key (loads .env in development)
import { getGeminiApiKey, isGeminiKeyPresent } from './config.js';
const GEMINI_API_KEY = getGeminiApiKey();
if (!isGeminiKeyPresent()) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY not set. Roadmap generation will fail.");
  console.log('Set it with (PowerShell): $env:GEMINI_API_KEY = "your_key_here"');
}

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PORT = process.env.PORT || 5178;

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Roadmap server is running", port: PORT });
});

app.post("/api/roadmap", async (req, res) => {
  const { topic } = req.body;
  console.log(">>> /api/roadmap called. topic=", topic);

  try {
    if (!GEMINI_API_KEY) {
      console.error('[server] GEMINI_API_KEY missing - aborting roadmap request');
      return res.status(500).json({ ok: false, error: 'Roadmap generation disabled: GEMINI_API_KEY not found. Add it to .env or environment variables.' });
    }
    // Build your prompt
    const prompt = `
Generate a complete learning roadmap for "${topic}".
Include topics in order and 2-3 online resources for each step
(links to documentation, courses, or GitHub repos). Return valid JSON like:
[
  {
    "step": "Step 1: Basics",
    "description": "Learn fundamentals",
    "resources": [
      { "title": "freeCodeCamp", "url": "https://www.freecodecamp.org", "type": "course" }
    ]
  }
]
    `;

    // Request to Gemini API
    const response = await axios.post(
      GEMINI_API_URL + "?key=" + GEMINI_API_KEY,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { timeout: 60000 } // 60s timeout
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("✅ Gemini response received");

    res.json({ ok: true, text });
  } catch (err) {
    console.error("[server] Error:", err.response?.data || err.message);
    res.status(500).json({
      ok: false,
      error: err.response?.data || err.message,
    });
  }
});

/**
 * POST /generate - Roadmap generator endpoint
 * Accepts: { prompt: "..." }
 * Returns: { ok: true, text: "..." } or { ok: false, error: "..." }
 */
app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    console.error("[server] /generate called without prompt");
    return res.status(400).json({
      ok: false,
      error: "Missing 'prompt' field in request body",
    });
  }

  console.log("[server] POST /generate - prompt length:", prompt.length);

  try {
    if (!GEMINI_API_KEY) {
      console.error('[server] GEMINI_API_KEY missing - aborting generate request');
      return res.status(500).json({ ok: false, error: 'Roadmap generation disabled: GEMINI_API_KEY not found. Add it to .env or environment variables.' });
    }
    // Call Gemini API with the provided prompt
    const response = await axios.post(
      GEMINI_API_URL + "?key=" + GEMINI_API_KEY,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { timeout: 60000 } // 60s timeout
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      console.warn("[server] Gemini returned empty response");
      return res.status(500).json({
        ok: false,
        error: "Gemini API returned empty response",
      });
    }

    console.log("[server] ✅ Gemini response received - length:", text.length);

    res.json({ ok: true, text: text });
  } catch (err) {
    const errMsg =
      err.response?.data?.error?.message || err.message || "Unknown error";
    console.error("[server] Gemini error:", errMsg);
    res.status(500).json({
      ok: false,
      error: errMsg,
    });
  }
});

// 404 handler - helps debug when endpoint is wrong
app.use((req, res) => {
  console.log("[server] 404 - Unknown endpoint:", req.method, req.path);
  res.status(404).json({
    ok: false,
    error:
      "Endpoint not found: " +
      req.path +
      ". Use POST /generate instead.",
  });
});

const server = app.listen(PORT, () => {
  console.log("");
  console.log("✅ Roadmap server listening on http://localhost:" + PORT);
  console.log("   Health check: GET http://localhost:" + PORT + "/health");
  console.log("   Roadmap generate: POST http://localhost:" + PORT + "/generate");
  console.log("");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[server] Shutting down...");
  server.close(() => {
    console.log("[server] Server closed");
    process.exit(0);
  });
});

