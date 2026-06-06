import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base keeps the build portable — works served from the root of a
// GitHub user site (https://<user>.github.io/) or any sub-path. The app uses
// hash-based routing, so no server rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
