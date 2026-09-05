import { globSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * The side panel and the options page are separate documents with separate
 * stylesheets. They stopped being separate once, when the options entry still
 * imported the panel's stylesheet: the panel needs `body { overflow: hidden }`
 * and `html, body { height: 100% }` to sit in a 400px rail, and those rules
 * silently made the settings page unscrollable.
 */
describe('page isolation', () => {
  const optionsFiles = globSync('src/options/**/*.{ts,tsx,css}');

  it('has options files to check', () => {
    expect(optionsFiles.length).toBeGreaterThan(0);
  });

  it('never imports side panel code or styles into the options page', () => {
    const offenders = optionsFiles.filter((file) =>
      /(?:from|import|@import)\s+['"][^'"]*sidepanel/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('never imports options code or styles into the side panel', () => {
    const offenders = globSync('src/sidepanel/**/*.{ts,tsx,css}').filter((file) =>
      /(?:from|import|@import)\s+['"][^'"]*\/options\//.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
