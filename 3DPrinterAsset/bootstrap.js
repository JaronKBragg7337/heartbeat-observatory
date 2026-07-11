import { installWorldPrinterRuntimeGuards } from './runtime-guards.js';

installWorldPrinterRuntimeGuards();

import('./main.js?v=2h').catch((error) => {
  console.error('[World Printer] Failed to start the live printer build.', error);
  const app = document.querySelector('#app');
  if (app) {
    app.innerHTML = '<main style="padding:24px;color:white;font-family:system-ui;background:#071012;min-height:100vh"><h1>World Printer Lab failed to start</h1><p>Open the browser console for the exact module error.</p></main>';
  }
});
