import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  isBlockedUrl,
  loadSettings,
  onSettingsChanged,
  saveSettings,
} from '../src/shared/settings';

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('merges a patch over what is stored', async () => {
    await saveSettings({ pausedEverywhere: true });
    await saveSettings({ model: 'claude-sonnet-5' });
    const settings = await loadSettings();
    expect(settings.pausedEverywhere).toBe(true);
    expect(settings.model).toBe('claude-sonnet-5');
    expect(settings.blockedDomains).toEqual(DEFAULT_SETTINGS.blockedDomains);
  });

  it('notifies subscribers when settings change', async () => {
    let seen = false;
    const unsubscribe = onSettingsChanged((settings) => {
      seen = settings.pausedEverywhere;
    });
    await saveSettings({ pausedEverywhere: true });
    unsubscribe();
    expect(seen).toBe(true);
  });
});

describe('isBlockedUrl', () => {
  const blocked = ['chase.com', 'mail.google.com'];

  it('blocks an exact host and its subdomains', () => {
    expect(isBlockedUrl('https://chase.com/account', blocked)).toBe(true);
    expect(isBlockedUrl('https://secure.chase.com/', blocked)).toBe(true);
  });

  it('matches on domain boundaries, not on substrings', () => {
    expect(isBlockedUrl('https://notchase.com/', blocked)).toBe(false);
    // A look-alike host on someone else's domain is not the blocked bank.
    expect(isBlockedUrl('https://chase.com.evil.test/', blocked)).toBe(false);
  });

  it('blocks anything that is not an ordinary web page', () => {
    expect(isBlockedUrl('chrome://extensions', blocked)).toBe(true);
    expect(isBlockedUrl('file:///Users/me/notes.txt', blocked)).toBe(true);
    expect(isBlockedUrl('not a url', blocked)).toBe(true);
  });

  it('allows an unlisted site', () => {
    expect(isBlockedUrl('https://shop.example/orders', blocked)).toBe(false);
  });
});
