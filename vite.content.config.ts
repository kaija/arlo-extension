import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Content scripts cannot be ES modules, so they get their own single-file IIFE
 * build that appends to the output of the main build.
 */
export default defineConfig({
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: false,
    target: 'chrome124',
    sourcemap: true,
    rollupOptions: {
      input: resolve(root, 'src/content/index.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
      },
    },
  },
});
