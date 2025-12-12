// Quick check script to verify GEMINI_API_KEY is present for roadmap server
const dotenv = require('dotenv');
try { dotenv.config(); } catch(e) {}

console.log('Files to check: roadmap-generator/server/index.js');
const key = process.env.GEMINI_API_KEY || '';
if (!key) {
  console.error('GEMINI_API_KEY is not set.');
  console.log('Create a .env file in the repository root with:');
  console.log('GEMINI_API_KEY=your_key_here');
  process.exitCode = 2;
} else {
  console.log('GEMINI_API_KEY is present. (first 8 chars):', key.slice(0,8) + '...');
}
