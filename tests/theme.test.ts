import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/shared/settings';
import { THEME_BOOT_KEY, applyTheme, watchTheme } from '../src/shared/theme';

// jsdom serves the test itself over http, so the file is found from the root.
const bootScript = readFileSync(resolve(process.cwd(), 'public/theme-boot.js'), 'utf8');

/** What the browser does with public/theme-boot.js, before anything renders. */
const boot = () => new Function(bootScript)();

beforeEach(() => {
  document.documentElement.removeAttribute('data-arlo');
  localStorage.clear();
});

describe('theme preference', () => {
  it('follows the OS until something is chosen', async () => {
    await expect(loadSettings()).resolves.toMatchObject({ theme: 'system' });
  });

  it('is stored, and rejects a value it does not recognise', async () => {
    await saveSettings({ theme: 'dark' });
    await expect(loadSettings()).resolves.toMatchObject({ theme: 'dark' });

    await chrome.storage.local.set({ 'arlo:settings': { ...DEFAULT_SETTINGS, theme: 'sepia' } });
    await expect(loadSettings()).resolves.toMatchObject({ theme: 'system' });
  });
});

describe('applyTheme', () => {
  it('forces a palette, and drops back to the OS on system', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-arlo')).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.getAttribute('data-arlo')).toBe('light');

    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-arlo')).toBe(false);
  });

  it('mirrors the choice where the boot script can read it synchronously', () => {
    applyTheme('dark');
    expect(localStorage.getItem(THEME_BOOT_KEY)).toBe('dark');
  });
});

describe('watchTheme', () => {
  it('applies a change made in Settings to an already-open surface', async () => {
    const stop = watchTheme();
    await saveSettings({ theme: 'dark' });
    expect(document.documentElement.getAttribute('data-arlo')).toBe('dark');

    await saveSettings({ theme: 'system' });
    expect(document.documentElement.hasAttribute('data-arlo')).toBe(false);
    stop();
  });
});

describe('theme-boot.js', () => {
  it('paints the mirrored choice before anything else runs', () => {
    applyTheme('dark');
    document.documentElement.removeAttribute('data-arlo');

    boot();
    expect(document.documentElement.getAttribute('data-arlo')).toBe('dark');
  });

  it('leaves the OS in charge when nothing is stored, or the value is junk', () => {
    boot();
    expect(document.documentElement.hasAttribute('data-arlo')).toBe(false);

    localStorage.setItem(THEME_BOOT_KEY, 'sepia');
    boot();
    expect(document.documentElement.hasAttribute('data-arlo')).toBe(false);
  });
});
