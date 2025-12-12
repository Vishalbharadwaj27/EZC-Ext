# Roadmap Generator Server

This is the internal Node.js server that powers the Roadmap Generator feature in the Unified VS Code Extension.

## Quick Start

### Windows
```batch
REM Navigate to this directory, then:
start.bat
```

Or manually:
```batch
npm install
node index.js
```

### macOS/Linux
```bash
npm install
node index.js
```

## What This Server Does

1. **Receives requests** from VS Code extension at `/generate` endpoint
2. **Calls Google Gemini API** with the user's prompt
3. **Returns formatted roadmap** HTML back to the extension
4. **Provides health check** at `/health` endpoint for diagnostics

## API Endpoints

### Health Check
```http
GET http://localhost:5178/health
```

Returns:
```json
{
  "ok": true,
  "message": "Roadmap server is running",
  "port": 5178
}
```

### Generate Roadmap
```http
POST http://localhost:5178/generate
Content-Type: application/json

{
  "prompt": "Create a learning roadmap for..."
}
```

Returns:
```json
{
  "ok": true,
  "text": "<h2>Your Roadmap</h2>..."
}
```

Or on error:
```json
{
  "ok": false,
  "error": "Error message describing what went wrong"
}
```

## Configuration

### Environment Variables
Create a `.env` file in this directory:

```env
GEMINI_API_KEY=your_api_key_here
PORT=5178
```

**Important**: The `GEMINI_API_KEY` is required. Get one from:
https://aistudio.google.com/apikey

### Port Customization
By default, the server runs on port `5178`. To change:

```bash
# Windows
set PORT=3000 && node index.js

# macOS/Linux
PORT=3000 node index.js
```

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin support for extension requests
- **axios**: HTTP client for Gemini API calls
- **dotenv**: Environment variable loading

Install with:
```bash
npm install
```

## Troubleshooting

### Server won't start
1. Check `.env` file has `GEMINI_API_KEY`
2. Verify Node.js and npm are installed: `node --version`, `npm --version`
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### "Port 5178 already in use"
Kill the existing process or use a different port:
```powershell
# Windows - Find process on port 5178
netstat -ano | findstr :5178

# Kill it
taskkill /PID <PID> /F

# Or use different port
set PORT=5179 && node index.js
```

### "Invalid API key" error
1. Get new key from https://aistudio.google.com/apikey
2. Update `GEMINI_API_KEY` in `.env`
3. Restart server

### Server returns "Unexpected token '<'" error
This means the server is returning HTML instead of JSON (likely a crash). Check:
1. Server console for error messages
2. Verify GEMINI_API_KEY is set
3. Verify internet connection
4. Check Gemini API rate limits

### "Cannot connect to roadmap server" in VS Code
1. Verify server is running: Open terminal and check for "listening on" message
2. Check health: `curl http://localhost:5178/health`
3. Verify port is correct in extension.js
4. Check firewall isn't blocking localhost connections

## Monitoring

The server logs every request and response:

```
✅ Roadmap server listening on http://localhost:5178
[server] POST /generate - prompt length: 245
[server] ✅ Gemini response received - length: 1523
```

Watch the console output while generating roadmaps to see the flow.

## Advanced: Testing with curl

```bash
# Test health endpoint
curl http://localhost:5178/health

# Test generate endpoint
curl -X POST http://localhost:5178/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a roadmap to learn JavaScript"}'
```

## Performance Notes

- Requests timeout after 60 seconds
- Gemini API responses are typically 1-3 seconds
- Large prompts may take longer (watch server logs)
- Each request counts toward your Gemini API quota

## Files

- `index.js` - Main server code
- `.env` - Configuration (API key and port)
- `package.json` - Dependencies
- `start.bat` - Windows startup script
- `check-status.bat` - Windows diagnostic script
- `SERVER_STARTUP_GUIDE.md` - Detailed troubleshooting guide

## See Also

- `SETUP_GUIDE.md` in project root for extension setup
- `INTEGRATION_SUMMARY.md` for architecture overview
- VS Code Extension Output panel shows "[Roadmap]" logs for debugging

## Architecture

```
VS Code Extension (port 1234)
        ↓ HTTP POST
Roadmap Server (port 5178)
        ↓ HTTPS
Google Gemini API
        ↓
Roadmap HTML
        ↓ HTTP Response
VS Code Extension
        ↓
Webview Display
```

The server is stateless and can be restarted anytime. The extension will automatically detect when it's running (via health check on startup).
