# EZCoder Unified Extension

A unified VS Code extension combining **EZCoder** (AI coding assistant) and **Roadmap Generator** into a single, seamless experience.

## Features

### EZCoder (Main Interface)
- **AI Chat Interface**: Ask coding questions and get detailed explanations
- **Generate Pseudocode**: Create pseudocode from concepts
- **Generate Code**: Generate production-ready code in multiple languages (Python, JavaScript, Java, C++, C#)
- **Clear Chat**: Reset the conversation history

### Roadmap Generator (Integrated as Secondary Panel)
- **Open Roadmap Generator**: Click the "📊 Roadmap Generator" button in the EZCoder panel to open the roadmap visualization
- Opens in a new webview panel within VS Code

## Project Structure

```
unified-extension/
├── extension.js              # Main extension entry point (handles both projects)
├── package.json             # Unified manifest
├── webview/                 # EZCoder UI files
│   ├── chat.html           # Main chat interface
│   ├── chat.js             # Chat logic with Roadmap button
│   └── chat.css            # Styling (includes roadmap button styles)
├── resources/              # EZCoder icons and assets
├── colabAPI.js             # API integration for Colab
├── huggingFaceAPI.js       # Hugging Face API integration
├── roadmap-generator/      # Roadmap Generator sub-project
│   ├── extension.js        # (Not used - integrated into main extension.js)
│   ├── package.json
│   ├── media/              # Roadmap UI assets
│   │   └── assets/         # Bundled JS/CSS for React app
│   │       ├── index-CGf0oPwP.js     # React runtime bundle
│   │       ├── index.es-BtI4hphF.js  # Roadmap app bundle
│   │       ├── purify.es-aGzT-_H7.js # DOMPurify library
│   │       └── index-dgf5YC8O.css    # Tailwind CSS
│   ├── webview/
│   └── server/
└── ...
```

## How It Works

### Main Flow
1. **Activation**: Extension activates when VS Code starts
2. **EZCoder Panel**: Shows AI chat interface in the EZCoder sidebar view
3. **Roadmap Button**: Click "📊 Roadmap Generator" button to open Roadmap Generator in a new panel
4. Both projects run independently but share the same extension context

### Key Changes from Original Projects

**No changes to either project's core functionality.** The integration:
- ✅ Keeps ez-coder code exactly as-is
- ✅ Keeps roadmap-generator code exactly as-is
- ✅ Unifies them via a single `extension.js` entry point
- ✅ Adds a "Open Roadmap" command/button to ez-coder
- ✅ Combines package.json dependencies

## Installation & Setup

### Prerequisites
- VS Code ^1.103.0
- Node.js 18+
- npm or yarn

### Installation Steps

1. **Navigate to the unified-extension directory**:
   ```bash
   cd "c:\Users\Visha\OneDrive\Desktop\Projectt\EZC combined\unified-extension"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Open in VS Code**:
   ```bash
   code .
   ```

4. **Run the extension**:
   - Press `F5` or go to **Run > Start Debugging** to launch the Extension Development Host
   - The extension will activate automatically

## Usage

### EZCoder Chat
1. Look for the EZCoder icon in the VS Code activity bar (left sidebar)
2. Click to open the AI Chat panel
3. **Ask a Question**: Type and press "Send" for explanations
4. **Generate Pseudocode**: Select text or type a concept, click "Generate Pseudocode"
5. **Generate Code**: Select a language, then click "Generate Code"
6. **Open Roadmap**: Click "📊 Roadmap Generator" to open the roadmap visualization

### Roadmap Generator
1. In the EZCoder panel, click the "📊 Roadmap Generator" button
2. A new panel opens with the roadmap generation interface
3. All roadmap features work as in the original extension

## Configuration

### API Configuration (EZCoder)
Set the Colab API base URL in VS Code settings:
```json
{
  "ezcoder.apiBase": "https://your-api-url"
}
```

### Environment Variables
Create a `.env` file in the root directory:
```env
COLAB_API_URL=https://your-colab-api-url
HUGGINGFACE_API_KEY=your-hf-api-key
```

## Development

### File to Update for Changes

- **Main Extension Logic**: `extension.js`
- **EZCoder UI**: `webview/chat.html`, `webview/chat.js`, `webview/chat.css`
- **Add Roadmap Button**: Already integrated in `chat.html`, `chat.js`, `chat.css`
- **Manifest**: `package.json` (commands, views, configuration)

### Build & Package

To package as a .vsix file for distribution:
```bash
npm install -g vsce
vsce package
```

This creates `ez-coder-unified-1.0.0.vsix`

## Troubleshooting

### Roadmap Generator not opening?
- Verify files exist: `roadmap-generator/media/assets/`
- Check VS Code console (Ctrl+Shift+J) for errors
- Ensure CSP policy allows the scripts

### API calls failing?
- Check `.env` file exists with correct API keys
- Verify network connectivity
- Check VS Code output panel for error details

### Chat not responding?
- Ensure `colabAPI.js` and `huggingFaceAPI.js` are in the root
- Check API configuration in VS Code settings
- Verify API credentials are correct

## Commands

Both projects' commands are available:

```
ez-coder.start              - Open EZCoder Chat
ez-coder.completeCode       - Complete My Code
ez-coder.clearChat          - Clear Chat
unified.openRoadmap         - Open Roadmap Generator
```

## Dependencies

### Runtime Dependencies
- `node-fetch`: ^2.7.0 (HTTP requests)
- `dotenv`: ^17.2.2 (Environment variables)

### Dev Dependencies
- `@types/node`: 22.x
- `@types/vscode`: ^1.103.0

## Original Projects

- **EZCoder**: AI coding assistant
  - Original location: `ez-coder/ez-coder/`
  - Main file: `extension.js`

- **Roadmap Generator**: Learning path visualization
  - Original location: `roadmap-generator-extension/roadmap-generator-extension/`
  - Main file: `extension.js`

## License

Both projects maintain their original licenses.

## Support

For issues, check the original project READMEs:
- EZCoder: `../ez-coder/ez-coder/README.md`
- Roadmap Generator: `roadmap-generator/README.md`

---

**Built as a unified extension combining two powerful tools for developers.**
