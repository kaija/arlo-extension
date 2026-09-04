#!/usr/bin/env node
/** Zips dist/ into release/<name>-<version>.zip for upload to the Web Store. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const releaseDir = resolve(root, 'release');

try {
  statSync(resolve(dist, 'manifest.json'));
} catch {
  console.error('dist/manifest.json is missing — run `npm run build` first.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const zipPath = resolve(releaseDir, `${pkg.name}-${pkg.version}.zip`);

mkdirSync(releaseDir, { recursive: true });
rmSync(zipPath, { force: true });

try {
  // Zipped from inside dist so the manifest sits at the archive root, as the
  // Web Store requires. Source maps are development-only, so they stay out.
  execFileSync('zip', ['-r', '-q', zipPath, '.', '-x', '*.map'], { cwd: dist });
} catch (error) {
  console.error('Packaging needs the `zip` command on PATH.');
  throw error;
}

console.log(`✓ ${zipPath} (${(statSync(zipPath).size / 1024).toFixed(1)} KB)`);
