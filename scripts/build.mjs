#!/usr/bin/env node
/**
 * One Vite pass makes the extension: the pages and the module service worker.
 *
 * A second pass used to build the content script as a single IIFE. The agent
 * now runs in a local bridge process rather than in the page, so there is no
 * content script; parked/vite.content.config.ts has that pass if it returns.
 */
import { build } from 'vite';

const watch = process.argv.includes('--watch');

const passes = [{ name: 'pages + service worker', configFile: 'vite.config.ts' }];

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
