import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the whole app into one self-contained ../public/insight/index.html.
// Main's Vite build copies public/* into dist verbatim, and the
// "Deploy Kithra to GitHub Pages" workflow publishes dist on every push to
// main — so after a merge, the app is live at
// https://praveensaraswat12.github.io/PraveenSaraswat12/insight/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: '../public/insight',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
    target: 'es2020',
  },
});
