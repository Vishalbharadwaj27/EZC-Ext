# Roadmap Generator — Local testing guide

This repository is a simple VS Code extension that opens a webview UI.

## Quick checks (what I inspected)
- `package.json` activates on command `roadmap-generator.openApp` and points to `./extension.js`.
- `extension.js` creates a webview panel and rewrites `src`/`href` attributes that start with `/` to use the webview `baseUri`.
- `webview/index.html` references assets with absolute paths like `/assets/index-DUrn4bQH.js` and `/assets/index-DYSNvMuV.css` that are present in the `assets/` folder.

## How to run (Windows / PowerShell)
1. Open the workspace folder in VS Code: File → Open Folder → select this project.
2. (Optional) Install dependencies if you plan to modify builds:
   - `npm install` (this repo currently has no build step required to run the extension; node modules may already exist.)
3. Press F5 to launch the Extension Development Host (or use the debug configuration `Run Extension (Extension Development Host)`).
4. In the new Extension Development Host window, open the Command Palette (Ctrl+Shift+P) and run `📍 Open Roadmap Generator`.

## What to verify (manual tests)
- The webview panel titled `📍 Roadmap Generator` opens.
- The UI in the webview renders (looks like the app's page and not a blank page).
- Open developer tools for the host and the webview to check console for errors:
  - In the Extension Development Host window, open Help → Toggle Developer Tools.
  - In the DevTools, find the iframe for the webview under the `Elements` tab and inspect console/Network for missing files or errors.

## Common issues and troubleshooting
- Blank webview or 404s for assets: confirm `extension.js`'s replacement of `src="/` and `href="/` works. The script replaces occurrences of `src`/`href` that start with `/` in `index.html` with a webview baseUri.
- CSP/security: the extension allows scripts by using `enableScripts: true`. If the webview uses eval or dynamic script injection, DevTools will show CSP violation errors.

## Next steps I recommend
- (Optional) Add a tiny smoke test or a GitHub Actions job to validate `npm install` (if you add build steps) and that `package.json` is valid.
- Add instructions to rebuild web assets if you plan to change the front-end (not currently required if assets are prebuilt).

If you want, I can:
- Run quick static checks (lint, parse) or add an automated smoke test.
- Add a minimal test script that checks `webview/index.html` references exist in `assets/`.
- Walk through a live debug session and point out any console errors and fixes.