import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/jspdf')) return 'vendor-pdf';
            if (id.includes('node_modules/jszip')) return 'vendor-zip';
            if (id.includes('node_modules/html2canvas')) return 'vendor-canvas';
            if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            if (id.includes('node_modules/jsqr') || id.includes('node_modules/qrcode')) return 'vendor-qr';
            if (id.includes('idCardTemplateAssets')) return 'assets-idcard';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
      },
      // PayStation API reverse proxy — avoids CORS during local development.
      // In production, Supabase Edge Functions handle server-side PayStation calls
      // so merchant credentials never touch the browser.
      proxy: {
        '/api/paystation': {
          target: 'https://sandbox.paystation.com.bd',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/paystation/, ''),
        },
        '/api/paystation-live': {
          target: 'https://api.paystation.com.bd',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/paystation-live/, ''),
        },
      },
    },
    preview: {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
      },
    },
  };
});
