#!/usr/bin/env node
/**
 * Two Vite passes make one extension:
 *   1. the pages and the module service worker
 *   2. the content script, which must be a single IIFE file
 * The second pass appends to dist, so order matters.
 */
import { build } from 'vite';

const watch = process.argv.includes('--watch');

const passes = [
  { name: 'pages + service worker', configFile: 'vite.config.ts' },
  { name: 'content script', configFile: 'vite.content.config.ts' },
];

for (const pass of passes) {
  console.log(`\n▸ building ${pass.name}`);
  await build({
    configFile: pass.configFile,
    build: watch ? { watch: {} } : {},
    logLevel: 'info',
  });
}

console.log(
  watch
    ? '\n✓ watching. Load the unpacked extension from ./dist'
    : '\n✓ built. Load the unpacked extension from ./dist',
);
