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
    // Split rarely-changing vendor code into its own cached chunks so the app
    // chunk stays small and repeat visits download less.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
