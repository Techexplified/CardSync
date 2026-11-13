import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        modal: resolve(import.meta.dirname, 'modal.html'),
        auth: resolve(import.meta.dirname, 'auth.html'),
        popup: resolve(import.meta.dirname, 'popup.html'),
        settings: resolve(import.meta.dirname, 'settings.html'),
      },
    },
  },
});
