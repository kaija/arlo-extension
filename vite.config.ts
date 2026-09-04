import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { createManifest } from './src/manifest.config';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(root, 'dist');

/**
 * The manifest is generated rather than hand-maintained so that the version
 * always matches package.json and the paths stay in sync with the build inputs.
 */
function manifestPlugin(): Plugin {
  return {
    name: 'arlo:manifest',
    apply: 'build',
    closeBundle() {
      const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
        version: string;
      };
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        resolve(outDir, 'manifest.json'),
        `${JSON.stringify(createManifest(pkg.version), null, 2)}\n`,
      );
    },
  };
}

export default defineConfig({
  root: resolve(root, 'src'),
  publicDir: resolve(root, 'public'),
  plugins: [react(), manifestPlugin()],
  build: {
    outDir,
    emptyOutDir: true,
    target: 'chrome124',
    sourcemap: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(root, 'src/sidepanel/index.html'),
        options: resolve(root, 'src/options/index.html'),
        background: resolve(root, 'src/background/index.ts'),
      },
      output: {
        // The service worker path is referenced verbatim by the manifest, so it
        // must not be hashed. Everything else is content-hashed.
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
