import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'

/** Chrome DevTools injects web-vitals profiling that can throw on SPA navigation — not an app bug. */
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || '');
      const src = String(event.filename || '');
      if (
        msg.includes("reading 'startTime'") &&
        (src.startsWith('VM') || msg.includes('reportAllChanges'))
      ) {
        event.preventDefault();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
