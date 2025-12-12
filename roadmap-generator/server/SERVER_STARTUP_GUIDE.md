# Roadmap Server Troubleshooting Guide

## Quick Start

### Windows (Recommended)
1. Navigate to the roadmap-generator/server folder
2. Double-click `start.bat`
3. The server should start on `http://localhost:5178`
4. Keep this terminal open while using the extension

### macOS/Linux
```bash
cd roadmap-generator/server
npm install
node index.js
```

## Verify Server is Running

### Option 1: Test in Browser or curl
```bash
# Check health endpoint
curl http://localhost:5178/health

# Should return: {"ok":true,"message":"Roadmap server is running","port":5178}
```

### Option 2: Check Port in Use
**Windows (PowerShell as Admin):**
```powershell
netstat -ano | findstr :5178
```

**macOS/Linux:**
```bash
lsof -i :5178
```

## Common Issues & Solutions

### ❌ Error: "GEMINI_API_KEY missing in .env file"
**Solution:**
1. Open `roadmap-generator/server/.env`
2. Verify it contains: `GEMINI_API_KEY=AIzaSyCNXD1ZyMG0_s29LS7GKBalMMB64mXzTM0`
3. Restart the server

### ❌ Error: "Port 5178 is already in use"
**Solution:**
```powershell
# Windows - Find and kill process using port 5178
netstat -ano | findstr :5178
taskkill /PID <PID_NUMBER> /F

# Or change PORT in server
# set PORT=5179 && node index.js
```

### ❌ Error: "npm ERR! code ERESOLVE"
**Solution:**
```bash
cd roadmap-generator/server
npm install --legacy-peer-deps
node index.js
```

### ❌ VS Code says "Could not connect to roadmap server"
**Debug steps:**
1. Check if server is running: `curl http://localhost:5178/health`
2. Look at Extension Output panel (should show "[Roadmap]" logs)
3. Check server console for error messages
4. Verify internet connection (Gemini API needs cloud access)

### ❌ Error: "Gemini error: 429 Too Many Requests"
**Solution:**
- Wait a few minutes before retrying
- Check your Gemini API quota in Google Cloud Console

### ❌ Error: "Gemini error: Invalid API key"
**Solution:**
1. Go to https://aistudio.google.com/apikey
2. Copy the valid API key
3. Update `roadmap-generator/server/.env` with new key
4. Restart the server

## Testing the Flow

### 1. Server is Ready
```bash
curl -X GET http://localhost:5178/health
# Expected: {"ok":true,"message":"Roadmap server is running","port":5178}
```

### 2. Test Generate Endpoint
```bash
curl -X POST http://localhost:5178/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a roadmap to learn Node.js"}'
# Expected: {"ok":true,"text":"...generated content..."}
```

### 3. Test in VS Code Extension
1. Open VS Code
2. Open Unified Extension project in Debug mode (F5)
3. Switch to Roadmap Generator panel
4. Enter project name and click "Generate Roadmap"
5. Check Extension Output for [Roadmap] logs

## Server Logs Explained

**Normal startup:**
```
✅ Roadmap server listening on http://localhost:5178
   Health check: GET http://localhost:5178/health
   Roadmap generate: POST http://localhost:5178/generate
```

**Processing request:**
```
[server] POST /generate - prompt length: 245
[server] ✅ Gemini response received - length: 1523
```

**Error indicators:**
```
[server] Gemini error: 401 - Invalid API key
[server] 404 - Unknown endpoint: POST /unknown
```

## Architecture Reminder

```
VS Code Extension UI
        ↓
extension.js (POST to localhost:5178/generate)
        ↓
roadmap-generator/server/index.js (Express server)
        ↓
Google Gemini API (Cloud)
```

The server is the bridge between VS Code and Google Gemini. It must be running for roadmap generation to work.

## Still Having Issues?

1. **Check server console** for error messages
2. **Verify .env file** has correct API key
3. **Test endpoint directly** with curl/Postman
4. **Check Extension Output** in VS Code for [Roadmap] logs
5. **Enable verbose logging** - server now logs every step

For more help, see `SETUP_GUIDE.md` at the project root.
