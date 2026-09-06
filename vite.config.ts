import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Project-page base path, only for the production build the CI workflow
// runs. Local dev/preview stay at '/', preserving the exact workflow used
// throughout Plans 1-3 (http://localhost:5173, no /reader/ prefix).
export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/reader/' : '/';
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // Precache fonts too so reading typography works fully offline.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
        manifest: {
          name: 'Reader',
          short_name: 'Reader',
          start_url: base,
          scope: base,
          theme_color: '#0B0B0D',
          background_color: '#0B0B0D',
          display: 'standalone',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        }
      })
    ]
  };
});
