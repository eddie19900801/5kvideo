import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeAppShell } from './services/platform'

void initializeAppShell()
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The splash is part of the initial HTML so it is visible before React starts.
// Once the app has painted, remove it in one direction only: splash -> app.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash) return;
    window.setTimeout(() => {
      splash.classList.add('boot-splash-exit');
      window.setTimeout(() => splash.remove(), 380);
    }, 700);
  });
});
