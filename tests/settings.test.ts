import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  createLlmProfile,
  getDefaultLlmProfile,
  isBlockedUrl,
  isRemoteHttpOrigin,
  loadSettings,
  onSettingsChanged,
  profileEndpoint,
  saveSettings,
} from '../src/shared/settings';

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('merges a patch over what is stored', async () => {
    await saveSettings({ bridgeToken: 'token-abc' });
    const profile = { ...createLlmProfile('openai-responses'), model: 'gpt-5.6-terra' };
    await saveSettings({ llmProfiles: [profile], defaultLlmProfileId: profile.id });
    const settings = await loadSettings();
    expect(settings.bridgeToken).toBe('token-abc');
    expect(getDefaultLlmProfile(settings)?.model).toBe('gpt-5.6-terra');
    expect(settings.bridgeUrl).toBe(DEFAULT_SETTINGS.bridgeUrl);
  });

  it('keeps session-only API keys out of local settings', async () => {
    const profile = {
      ...createLlmProfile('openai-responses'),
      model: 'model-a',
      apiKey: 'session-secret',
      rememberApiKey: false,
    };
    await saveSettings({ llmProfiles: [profile], defaultLlmProfileId: profile.id });

    const local = await chrome.storage.local.get('arlo:settings');
    const persisted = local['arlo:settings'] as { llmProfiles: Array<{ apiKey: string }> };
    expect(persisted.llmProfiles[0]?.apiKey).toBe('');
    await expect(loadSettings()).resolves.toMatchObject({
      llmProfiles: [{ apiKey: 'session-secret', rememberApiKey: false }],
    });
  });

  it('discards the legacy flat model and API key fields', async () => {
    await chrome.storage.local.set({
      'arlo:settings': { ...DEFAULT_SETTINGS, model: 'legacy-model', apiKey: 'legacy-secret' },
    });
    const settings = await loadSettings();
    expect(settings.llmProfiles).toEqual([]);
    expect(settings.defaultLlmProfileId).toBeNull();
    expect(settings).not.toHaveProperty('model');
    expect(settings).not.toHaveProperty('apiKey');
  });

  it('notifies subscribers when settings change', async () => {
    let seen = false;
    const unsubscribe = onSettingsChanged((settings) => {
      seen = settings.bridgeToken === 'watched';
    });
    await saveSettings({ bridgeToken: 'watched' });
    unsubscribe();
    expect(seen).toBe(true);
  });
});

describe('LLM profiles', () => {
  it('derives request endpoints from the API root and contract', () => {
    const anthropic = createLlmProfile('anthropic-messages');
    const responses = createLlmProfile('openai-responses');
    const chat = createLlmProfile('openai-chat-completions');
    expect(profileEndpoint(anthropic)).toBe('https://api.anthropic.com/v1/messages');
    expect(profileEndpoint(responses)).toBe('https://api.openai.com/v1/responses');
    expect(profileEndpoint(chat)).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('warns only for non-loopback HTTP origins', () => {
    expect(isRemoteHttpOrigin('http://models.example')).toBe(true);
    expect(isRemoteHttpOrigin('http://localhost:11434')).toBe(false);
    expect(isRemoteHttpOrigin('https://models.example')).toBe(false);
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
