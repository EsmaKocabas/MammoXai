import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Geliştirmede /api ve /uploads isteklerini backend'e (5001) yönlendir
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5001',
      '/uploads': 'http://localhost:5001',
    },
  },
});
