// Simple config helper for the roadmap server
// Loads environment variables in development and exposes GEMINI key access

import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  try { dotenv.config(); } catch (e) { /* ignore */ }
}

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

export function isGeminiKeyPresent() {
  const k = getGeminiApiKey();
  return Boolean(k && k !== 'YOUR_GEMINI_API_KEY_HERE');
}
