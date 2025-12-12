(function () {
    const vscode = acquireVsCodeApi();
    const container = document.getElementById('graph-container');
    const titleEl = document.getElementById('func-title');
    const badgeEl = document.getElementById('meter-badge');

    let isInitialized = false;
    let isReady = false;

    // Zoom/Pan State
    let scale = 1, panX = 20, panY = 20, isDragging = false, startX, startY;
    let viz = null;

    // --- INIT ---
    async function init() {
        if (viz) return viz;
        try {
            console.log('[CodeViz webview] Starting initialization...');

            // 1. Load Main Lib
            console.log('[CodeViz webview] Loading main viz library:', window.__vizMain);
            await loadScript(window.__vizMain);
            console.log('[CodeViz webview] Main viz library loaded');

            // 2. THE FIX: Fetch the worker script and create a local Blob
            // This avoids "importScripts" cross-origin issues and ensures the worker runs.
            const workerUri = window.__vizWorker;
            console.log('[CodeViz webview] Fetching worker from:', workerUri);

            let blobUrl;
            try {
                const response = await fetch(workerUri);
                if (!response.ok) throw new Error(`Failed to fetch worker: ${response.statusText}`);
                const workerScript = await response.text();
                const blob = new Blob([workerScript], { type: 'application/javascript' });
                blobUrl = URL.createObjectURL(blob);
                console.log('[CodeViz webview] Worker Blob URL created:', blobUrl);
            } catch (err) {
                console.error('[CodeViz webview] Failed to create worker blob, falling back to URI:', err);
                blobUrl = workerUri;
            }

            // Initialize Viz with our safe Blob URL
            viz = new Viz({ workerURL: blobUrl });
            console.log('[CodeViz webview] Viz instance created successfully');

            // Signal ready to extension host on first init
            if (!isInitialized) {
                isInitialized = true;
                console.log('[CodeViz webview] ✅ Initialization complete, sending ready signal');
                vscode.postMessage({ command: 'codeviz.ready' });
                isReady = true;
            }

            return viz;
        } catch (e) {
            console.error('[CodeViz webview] ❌ Viz Init Error:', e);
            console.log('[CodeViz webview] Posting vizLoadFailed message');
            vscode.postMessage({ command: 'codeviz.vizLoadFailed', detail: String(e) });
            throw e;
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            console.log('[CodeViz webview] Checking script:', src);
            if (document.querySelector(`script[src="${src}"]`)) {
                console.log('[CodeViz webview] Script already loaded');
                return resolve();
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => {
                console.log('[CodeViz webview] Script loaded successfully');
                resolve();
            };
            s.onerror = (err) => {
                console.error('[CodeViz webview] Script load error:', err);
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(s);
        });
    }

    // --- RENDER ---
    window.addEventListener('message', async (e) => {
        console.log('[CodeViz webview] Message received:', e.data.command);

        if (e.data.command === 'renderGraph' || e.data.type === 'renderGraph') {
            console.log('[CodeViz webview] Processing renderGraph request:', e.data.funcName);
            titleEl.textContent = e.data.funcName;

            // Complexity Badge
            const c = e.data.complexity;
            badgeEl.textContent = `${c} (Complexity)`;
            badgeEl.className = `badge ${c < 5 ? 'green' : c < 10 ? 'orange' : 'red'}`;

            // Render Graph
            try {
                container.innerHTML = '<div style="padding:20px;color:#888;">⏳ Rendering...</div>';
                console.log('[CodeViz webview] Initializing viz...');
                const v = await init();
                console.log('[CodeViz webview] Viz ready, rendering SVG...');

                const svg = await v.renderSVGElement(e.data.dot);
                console.log('[CodeViz webview] SVG rendered successfully');

                container.innerHTML = '';
                svg.style.width = '100%';
                svg.style.height = '100%';
                container.appendChild(svg);
                console.log('[CodeViz webview] ✅ Graph rendered and inserted into DOM');

                // Attach Clicks
                svg.querySelectorAll('.node').forEach(n => {
                    if (n.id && n.id.includes('|')) {
                        n.onclick = (evt) => {
                            evt.stopPropagation();
                            const [_, start, end] = n.id.split('|');
                            vscode.postMessage({ type: 'revealCode', start, end });
                        };
                    }
                });
            } catch (err) {
                const errMsg = `Render Error: ${err.message}`;
                container.innerHTML = `<div style="color:red; padding:20px">❌ ${errMsg}</div>`;
                console.error('[CodeViz webview] ❌ Render Error:', err);
                // Notify extension host of render error
                vscode.postMessage({ command: 'codeviz.renderError', error: err.message });
            }
        } else {
            // Log unhandled messages for debugging
            console.warn('[CodeViz webview] ⚠️ Unhandled message:', e.data);
            vscode.postMessage({ command: 'codeviz.unhandledMessage', data: e.data });
        }
    });

    // --- CONTROLS ---
    const update = () => container.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;

    document.getElementById('btn-zoom-in').onclick = () => { scale *= 1.2; update(); };
    document.getElementById('btn-zoom-out').onclick = () => { scale /= 1.2; update(); };
    document.getElementById('btn-reset').onclick = () => { scale = 1; panX = 20; panY = 20; update(); };

    document.getElementById('viewport').onmousedown = (e) => { isDragging = true; startX = e.clientX - panX; startY = e.clientY - panY; };
    window.onmouseup = () => isDragging = false;
    window.onmousemove = (e) => { if (isDragging) { panX = e.clientX - startX; panY = e.clientY - startY; update(); } };

    console.log('[CodeViz webview] 🚀 Webview script loaded and ready');
})();