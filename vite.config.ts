import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// NOTE: vite-plugin-pwa is temporarily removed while the app shakes out.
// Early deploys registered a service worker under a different scope
// (/picklepair/ instead of /pickle-pair/) which stuck around in browsers and
// served cached 404s. src/main.tsx now actively unregisters any leftover SW
// so visitors self-heal on next load. We'll reintroduce the PWA once the
// deployment is stable.

export default defineConfig({
  base: '/pickle-pair/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
