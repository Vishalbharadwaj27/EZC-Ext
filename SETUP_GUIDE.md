# Setup Guide - EZCoder Unified Extension

## Quick Start (5 minutes)

### Step 1: Navigate to Project
```powershell
cd "c:\Users\Visha\OneDrive\Desktop\Projectt\EZC combined\unified-extension"
```

### Step 2: Install Dependencies
```powershell
npm install
```

### Step 3: Open in VS Code
```powershell
code .
```

### Step 4: Run Extension
Press **F5** or go to **Run > Start Debugging** to launch the Extension Development Host.

### Step 5: Test It
1. Look for the **EZCoder** icon in the activity bar (left sidebar)
2. Click it to open the AI Chat panel
3. Click **"📊 Roadmap Generator"** button to see the roadmap generator

---

## Project Structure Overview

```
unified-extension/
├── 📄 extension.js                    ← Main entry point (unified)
├── 📄 package.json                    ← Manifest (combined)
├── 📁 webview/                        ← EZCoder UI
│   ├── chat.html                      (with Roadmap button)
│   ├── chat.js                        (with Roadmap handler)
│   └── chat.css                       (with Roadmap styles)
├── 📁 resources/                      ← Icons
├── 📁 roadmap-generator/              ← Roadmap Generator (unchanged)
│   ├── media/assets/
│   │   ├── index-CGf0oPwP.js         (React runtime)
│   │   ├── index.es-BtI4hphF.js      (App bundle)
│   │   ├── purify.es-aGzT-_H7.js     (DOMPurify)
│   │   └── index-dgf5YC8O.css        (Styles)
│   ├── webview/
│   ├── server/
│   └── extension.js                   (not used)
├── colabAPI.js                        ← Colab integration
├── huggingFaceAPI.js                  ← HF integration
└── ... other files
```

---

## What Was Changed?

### ✅ What's the Same
- ✅ All ez-coder files (unchanged)
- ✅ All roadmap-generator files (unchanged)
- ✅ No modifications to business logic
- ✅ Both projects work independently

### 🔄 What's New
- **extension.js**: Now loads both projects
- **package.json**: Combined manifest with both commands
- **chat.html**: Added "📊 Roadmap Generator" button
- **chat.js**: Added roadmap button click handler
- **chat.css**: Added styling for roadmap button
- **New command**: `unified.openRoadmap` → Opens roadmap generator

---

## Key Integration Points

### 1. Extension Activation (extension.js)
```javascript
function activate(context) {
    // Register ez-coder chat view
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "ez-coder.chatView",
            new EZCoderProvider(context)
        )
    );

    // Register open roadmap command
    context.subscriptions.push(
        vscode.commands.registerCommand("unified.openRoadmap", () => {
            openRoadmapGenerator(context);
        })
    );
}
```

### 2. Roadmap Button in EZCoder (chat.html)
```html
<button id="roadmapButton" class="action-btn roadmap-btn">
    📊 Roadmap Generator
</button>
```

### 3. Button Handler (chat.js)
```javascript
elements.roadmap.addEventListener("click", () => {
    vscode.postMessage({ command: "openRoadmap" });
});
```

### 4. Message Handling (extension.js)
```javascript
if (msg.command === "openRoadmap") {
    openRoadmapGenerator(this.context);
    return;
}
```

---

## Commands Available

| Command | Action |
|---------|--------|
| `ez-coder.start` | Open EZCoder Chat |
| `ez-coder.completeCode` | Complete My Code |
| `ez-coder.clearChat` | Clear Chat |
| `unified.openRoadmap` | Open Roadmap Generator |

Access via:
- **Cmd+Shift+P** → type command name
- **Click buttons in UI**

---

## Testing Checklist

- [ ] Extension activates without errors (F5)
- [ ] EZCoder chat view appears in activity bar
- [ ] Can type and send messages in chat
- [ ] "📊 Roadmap Generator" button is visible
- [ ] Click roadmap button opens new panel
- [ ] Roadmap panel loads without errors
- [ ] Both projects work independently

---

## Environment Setup (Optional)

Create `.env` file for API configuration:
```env
COLAB_API_URL=https://your-colab-api
HUGGINGFACE_API_KEY=your-hf-key
```

---

## Package & Distribute

To create a .vsix file for VS Code Marketplace:
```powershell
npm install -g vsce
vsce package
```

This creates: `ez-coder-unified-1.0.0.vsix`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension doesn't activate | Check VS Code console (Ctrl+Shift+J) for errors |
| Roadmap button not visible | Verify `webview/chat.html` has the button |
| Roadmap panel is blank | Check `roadmap-generator/media/assets/` exist |
| API calls fail | Verify `.env` file and API credentials |
| Module not found errors | Run `npm install` again |

---

## File Changes Summary

### Modified Files
- ✏️ `extension.js` (unified loader)
- ✏️ `package.json` (combined manifest)
- ✏️ `webview/chat.html` (added button)
- ✏️ `webview/chat.js` (added handler)
- ✏️ `webview/chat.css` (added styles)

### New Folders
- 📁 `roadmap-generator/` (copied entire project)

### Unchanged
- ✅ All other ez-coder files
- ✅ Original business logic

---

## Next Steps

1. **Test the extension** (F5)
2. **Verify both features work**
3. **Make any customizations needed**
4. **Package for distribution** (if needed)

---

For detailed info, see `UNIFIED_README.md`
