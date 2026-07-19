import { defineConfig } from 'vite';

export default defineConfig({
  // @tandem/shared is a workspace symlink shipping TS source; keep it out of
  // dependency pre-bundling so Vite transforms it like app code.
  optimizeDeps: {
    exclude: ['@tandem/shared'],
  },
  server: {
    port: 5173,
  },
});
