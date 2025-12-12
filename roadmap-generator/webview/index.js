// Roadmap webview UI controller
(() => {
  const vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;

  function q(sel){return document.querySelector(sel)}

  const topBtn = q('#topGenerateBtn');
  const genPanel = q('#generator-panel');
  const resultsPanel = q('#results-panel');
  const rgForm = q('#rg-form');
  const rgSubmit = q('#rg-submit');
  const rgCancel = q('#rg-cancel');
  const rgExportBtn = q('#rg-export');

  function showGenerator(){
    if(!genPanel) return;
    genPanel.classList.remove('rg-panel-hidden');
    genPanel.classList.add('rg-panel-visible','rg-reveal');
    genPanel.setAttribute('aria-hidden','false');
  }

  function hideGenerator(){
    if(!genPanel) return;
    genPanel.classList.remove('rg-panel-visible','rg-reveal');
    genPanel.classList.add('rg-panel-hidden');
    genPanel.setAttribute('aria-hidden','true');
  }

  function toggleGenerator(){
    if(!genPanel) return;
    const hidden = genPanel.classList.contains('rg-panel-hidden');
    if(hidden) showGenerator(); else hideGenerator();
  }

  function setGenerating(isGenerating){
    if(!rgSubmit) return;
    if(isGenerating){
      rgSubmit.disabled = true;
      rgSubmit.textContent = 'Generating...';
      rgSubmit.setAttribute('aria-busy', 'true');
    } else {
      rgSubmit.disabled = false;
      rgSubmit.textContent = 'Generate';
      rgSubmit.removeAttribute('aria-busy');
    }
  }

  function showExportButton(){
    if(rgExportBtn) rgExportBtn.style.display = 'inline-block';
  }

  function hideExportButton(){
    if(rgExportBtn) rgExportBtn.style.display = 'none';
  }

  // wire top button
  if(topBtn){
    topBtn.addEventListener('click', (e)=>{
      e.preventDefault();
      toggleGenerator();
    });
  }

  // Cancel button closes panel
  if(rgCancel){ rgCancel.addEventListener('click', ()=> hideGenerator()) }

  // Export button sends export message
  if(rgExportBtn){
    rgExportBtn.addEventListener('click', ()=>{
      console.log('[Roadmap Webview] User clicked Export PDF');
      if(vscode){
        vscode.postMessage({ command: 'roadmap.export' });
      } else {
        console.warn('[Roadmap Webview] VSCode API not available, cannot export');
      }
    });
  }

  // Submit: send message to extension backend, preserving existing message patterns when possible
  if(rgSubmit){
    rgSubmit.addEventListener('click', ()=>{
      // Collect form fields (safe minimal set)
      const payload = {};
      const pn = document.getElementById('projectName');
      const sc = document.getElementById('scope');
      if(pn) payload.projectName = pn.value || 'Project';
      if(sc) payload.scope = sc.value || 'general';

      console.log('[Roadmap Webview] Sending generate request:', payload);

      // Post message to extension. Keep command name generic so backend can route.
      if(vscode){
        setGenerating(true);
        hideExportButton();
        vscode.postMessage({ command: 'roadmap.generate', data: payload });
      } else {
        console.log('[Roadmap Webview] (No VSCode API) roadmap.generate', payload);
      }
    });
  }

  // Try to remove any legacy bottom generate button if present in DOM
  const legacyBtn = q('.generate-button, #generateBtn, button.generate');
  if(legacyBtn){ legacyBtn.remove(); }

  // Listen for messages from extension/backend and propagate to UI if necessary
  window.addEventListener('message', event => {
    const msg = event.data || {};
    console.log('[Roadmap Webview] Received message from extension:', msg);
    
    if(!msg || !msg.command) return;
    
    // Handle roadmap.result response from extension
    if(msg.command === 'roadmap.result'){
      setGenerating(false);
      
      // Try to inject into root element (primary), fallback to results-panel
      const root = document.getElementById('root');
      const resultsContainer = document.getElementById('results-panel');
      
      if(typeof msg.html === 'string'){
        if(root){
          root.innerHTML = msg.html;
          console.log('[Roadmap Webview] Roadmap HTML injected into #root');
        } else if(resultsContainer){
          resultsContainer.innerHTML = msg.html;
          console.log('[Roadmap Webview] Roadmap HTML injected into #results-panel');
        } else {
          console.warn('[Roadmap Webview] No root or results-panel element found; roadmap not displayed');
        }
        
        // Show export button if generation succeeded (no error message)
        if(!msg.html.includes('rg-error')){
          showExportButton();
        }
      } else {
        console.warn('[Roadmap Webview] Invalid roadmap.result: msg.html is not a string', msg.html);
      }
    }
  });

  // On load: nothing else (bundled app still mounts to #root)
  console.log('[Roadmap Webview] Controller initialized');
})();
