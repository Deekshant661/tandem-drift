import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the bundle works at any mount path (GitHub Pages
  // serves under /<repo>/).
  base: './',
  // @tandem/shared is a workspace symlink shipping TS source; keep it out of
  // dependency pre-bundling so Vite transforms it like app code.
  optimizeDeps: {
    exclude: ['@tandem/shared'],
  },
  server: {
    port: 5173,
  },
});
