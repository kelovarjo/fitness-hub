import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages serves the app from /fitness-hub/. Override with BASE_PATH for other hosts.
const base = process.env.BASE_PATH ?? '/fitness-hub/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fitness Hub',
        short_name: 'Fitness',
        description: 'Personal workout logger',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
