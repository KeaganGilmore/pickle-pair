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
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split only clearly-isolated libraries into their own long-cacheable
        // chunks. Splitting react / react-dom / react-router / @tanstack out
        // created circular imports with the generic vendor chunk which caused
        // "Cannot access X before initialization" at load. These stay
        // together in the default vendor chunk.
        manualChunks: {
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
          'vendor-dexie': ['dexie', 'dexie-react-hooks'],
          'vendor-qrcode': ['qrcode'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    host: true,
  },
});
