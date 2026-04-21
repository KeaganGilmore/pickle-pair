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
        // Split heavy vendor groups into long-cacheable chunks so the main
        // bundle stays lean and repeat visits load almost instantly.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('dexie')) return 'vendor-dexie';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('qrcode')) return 'vendor-qrcode';
          if (id.includes('zod')) return 'vendor-zod';
          return 'vendor';
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
