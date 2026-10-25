import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

/** which build this is, for bug reports: VITE_BUILD, the .build file a deployment writes, or git */
function build_id(): string {
  if (process.env.VITE_BUILD) return process.env.VITE_BUILD;
  try {
    return readFileSync(new URL('./.build', import.meta.url), 'utf8').trim();
  } catch { /* not a deployment */ }
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', 'src'], { encoding: 'utf8' }).trim() ? '+' : '';
    return sha + dirty;
  } catch {
    return 'unknown';
  }
}

// The game is served under /play/ (the portal, BalatroPortal, is at /). In
// development, open the portal's dev server (http://localhost:5174), which
// passes /play/ to this one; http://localhost:5173/play/ also works on its own.
export default defineConfig({
  base: '/play/',
  define: { 'import.meta.env.VITE_BUILD': JSON.stringify(build_id()) },
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
      // the bug report service (make run in ../BalatroBugReportService) on its default port
      '/reports': {
        target: process.env.BALATRO_REPORTS ?? 'http://127.0.0.1:8003',
        rewrite: (path) => path.replace(/^\/reports/, ''),
        headers: { 'X-Forwarded-Prefix': '/reports' },
      },
      // the identity service (make run) on its default port
      '/identity': {
        target: process.env.BALATRO_IDENTITY ?? 'http://127.0.0.1:8001',
        rewrite: (path) => path.replace(/^\/identity/, ''),
      },
    },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
