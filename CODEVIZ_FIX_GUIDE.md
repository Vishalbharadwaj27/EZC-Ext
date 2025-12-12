# CodeViz Visualization Fix — URI Scheme Error Resolution

## Problem Fixed

**Error:** `[UriError]: Scheme contains illegal characters`

**Root Cause:** Windows file paths with backslashes were being converted to URIs improperly, causing malformed scheme strings in the webview.

## Changes Made

### 1. Fixed URI Generation (extension.js)

Changed from:
```javascript
const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
const mainUri = webview.asWebviewUri(vscode.Uri.file(mainLib));
const workerUri = webview.asWebviewUri(vscode.Uri.file(workerLib));
const webviewJsUri = webview.asWebviewUri(vscode.Uri.file(webviewJsPath));
```

To:
```javascript
const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath)).toString();
const mainUri = webview.asWebviewUri(vscode.Uri.file(mainLib)).toString();
const workerUri = webview.asWebviewUri(vscode.Uri.file(workerLib)).toString();
const webviewJsUri = webview.asWebviewUri(vscode.Uri.file(webviewJsPath)).toString();
```

**Why:** Explicitly converting to string ensures proper URI formatting with forward slashes only.

### 2. Added Comprehensive Logging

Added diagnostic logs to help track the URI generation:
```javascript
console.log('[CodeViz] Generated URIs:');
console.log('  - cssUri:', cssUri);
console.log('  - mainUri:', mainUri);
console.log('  - workerUri:', workerUri);
console.log('  - webviewJsUri:', webviewJsUri);
```

And file verification:
```javascript
console.log('[CodeViz] Media files verified:');
console.log('  - mainLib:', mainLib);
console.log('  - workerLib:', workerLib);
console.log('  - webviewJs:', webviewJsPath);
console.log('  - css:', cssPath);
```

### 3. Enhanced Webview Logging (webview.js)

Added detailed logging at each initialization step:
- Library loading status
- Worker blob creation
- Viz instance creation
- Message reception and processing
- Error reporting with stack traces

## Testing the Fix

### Step 1: Check Extension Host Console

1. Press **Ctrl+F5** to launch the extension
2. Open VS Code **Output** panel: `View → Output`
3. Select **Extension Host** from the dropdown
4. Look for these logs:

```
[CodeViz] Media files verified:
  - mainLib: C:\Users\Visha\OneDrive\Desktop\unified-extension\codeviz\codeviz\media\viz.js
  - workerLib: C:\Users\Visha\OneDrive\Desktop\unified-extension\codeviz\codeviz\media\viz.full.render.js
  - webviewJs: C:\Users\Visha\OneDrive\Desktop\unified-extension\codeviz\codeviz\media\webview.js
  - css: C:\Users\Visha\OneDrive\Desktop\unified-extension\codeviz\codeviz\media\webview.css

[CodeViz] Generated URIs:
  - cssUri: vscode-webview://...
  - mainUri: vscode-webview://...
  - workerUri: vscode-webview://...
  - webviewJsUri: vscode-webview://...
```

**Expected:** All URIs should start with `vscode-webview://` (not `file://` and definitely no backslashes)

### Step 2: Open CodeViz Panel

1. Press **Ctrl+Shift+P**
2. Type "Visualize Function"
3. Open a JavaScript/TypeScript file
4. Place cursor inside any function
5. Run the command

**Expected in console:**
```
[CodeViz webview] 🚀 Webview script loaded and ready
[Extension] CodeViz webview is ready, flushing queue
[CodeViz webview] Starting initialization...
[CodeViz webview] Loading main viz library: vscode-webview://...
[CodeViz webview] Main viz library loaded
[CodeViz webview] Worker URL: vscode-webview://...
[CodeViz webview] Worker Blob URL created: blob:...
[CodeViz webview] Viz instance created successfully
[CodeViz webview] ✅ Initialization complete, sending ready signal
```

### Step 3: Verify Graph Renders

1. After running the command, you should see:
   - **CodeViz panel opens** (on the left side)
   - **Function name appears** in the header
   - **Graph renders** showing the call flow
   - **No red error messages** in the graph container

**Expected in console:**
```
[CodeViz webview] Message received: renderGraph
[CodeViz webview] Processing renderGraph request: myFunctionName
[CodeViz webview] Initializing viz...
[CodeViz webview] Viz ready, rendering SVG...
[CodeViz webview] SVG rendered successfully
[CodeViz webview] ✅ Graph rendered and inserted into DOM
```

### Step 4: Check for URI Error

If you **DO NOT** see the error message:
```
[UriError]: Scheme contains illegal characters
```

Then the fix is **successful** ✅

## Verification Checklist

- [ ] Extension Host console shows URIs starting with `vscode-webview://`
- [ ] No backslashes (`\`) appear in any URI
- [ ] CodeViz panel opens without errors
- [ ] Graph renders within 2 seconds
- [ ] Function name and complexity badge appear
- [ ] No red error box in the graph container
- [ ] No `[UriError]` messages in VS Code console
- [ ] Console logs show `✅ Initialization complete` message

## If Issues Persist

### Check 1: Media Files Exist
```bash
cd c:\Users\Visha\OneDrive\Desktop\unified-extension\codeviz\codeviz\media
ls -la viz.js viz.full.render.js webview.js webview.css
```

All 4 files should exist.

### Check 2: Clear VS Code Cache
```bash
# Close VS Code completely
# Delete extension cache
rm -r %APPDATA%\Code\CachedExtensionVSIXs\*

# Relaunch VS Code and run extension again
```

### Check 3: Rebuild Media Files
```bash
cd c:\Users\Visha\OneDrive\Desktop\unified-extension\codeviz\codeviz
npm run compile
```

Then retry the visualization.

## Summary

The URI scheme error was caused by improper path-to-URI conversion on Windows. This fix:

✅ Explicitly converts URIs to strings with proper formatting
✅ Adds comprehensive logging for debugging
✅ Ensures forward slashes only (no backslashes in URIs)
✅ Validates media file existence before webview creation
✅ Provides clear error messages if resources are missing

**CodeViz visualization should now work reliably.**
