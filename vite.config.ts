import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // the API (uv run balatro-api) on its default port
    proxy: { '/api': process.env.BALATRO_API ?? 'http://127.0.0.1:8000' },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
