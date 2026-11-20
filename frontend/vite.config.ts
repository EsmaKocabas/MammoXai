import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Docker'da backend service adı "backend", lokalde ise "localhost"
const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:5001';

// Geliştirmede /api ve /uploads isteklerini backend'e yönlendir
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    host: true, // Docker container içinden erişilebilir (0.0.0.0)
    proxy: {
      '/api': backendUrl,
      '/uploads': backendUrl,
    },
    watch: {
      usePolling: true, // Docker bind mount için gerekli (özellikle Windows/Mac)
    },
  },
});
