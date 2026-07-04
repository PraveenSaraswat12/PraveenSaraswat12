import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the whole app into one self-contained ../insight/index.html,
// served by GitHub Pages at /PraveenSaraswat12/insight/ (same deploy
// pattern as the root Kithra app).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: '../insight',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
    target: 'es2020',
  },
});
