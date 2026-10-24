import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// The game is served under /play/ (the portal, BalatroPortal, is at /). In
// development, open the portal's dev server (http://localhost:5174), which
// passes /play/ to this one; http://localhost:5173/play/ also works on its own.
export default defineConfig({
  base: '/play/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // the page may come through the portal's dev server: hot reload connects here directly
    hmr: { clientPort: 5173 },
    proxy: {
      // the API (uv run balatro-api) on its default port
      '/api': process.env.BALATRO_API ?? 'http://127.0.0.1:8000',
      // the identity service (make run) on its default port
      '/identity': {
        target: process.env.BALATRO_IDENTITY ?? 'http://127.0.0.1:8001',
        rewrite: (path) => path.replace(/^\/identity/, ''),
      },
    },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
