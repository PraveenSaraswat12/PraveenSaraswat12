import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One-off config: bundles the entire app into a single self-contained HTML file
// (dist-single/index.html) so it can be uploaded as one file and served anywhere.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-single', cssCodeSplit: false, assetsInlineLimit: 100000000, sourcemap: false, reportCompressedSize: false },
});
