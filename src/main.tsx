import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { ensureSeeded } from './db';

registerSW({ immediate: true });

// Ask the browser to keep this site's data even under storage pressure (installed PWAs on iOS).
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

ensureSeeded()
  .catch((e) => console.error('Seeding failed', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
