import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createLlmProfile,
  profileGeminiLiveUrl,
  profileRealtimeUrl,
  saveSettings,
  loadSettings,
  voiceEnabled,
} from '../src/shared/settings';
import { loadTraditionalConverter } from '../src/sidepanel/voice';

afterEach(() => vi.unstubAllGlobals());

describe('voice settings', () => {
  it('starts with voice off, and only the OpenAI wire formats can turn it on', () => {
    const responses = createLlmProfile('openai-responses');
    expect(responses.voiceModel).toBe('');
    expect(voiceEnabled(responses)).toBe(false);
    expect(voiceEnabled({ ...responses, voiceModel: 'gpt-4o-transcribe' })).toBe(true);
    expect(voiceEnabled({ ...responses, voiceModel: ' ' })).toBe(false);
    const gemini = createLlmProfile('gemini');
    expect(voiceEnabled({ ...gemini, voiceModel: 'x' })).toBe(true);
    const anthropic = createLlmProfile('anthropic-messages');
    expect(voiceEnabled({ ...anthropic, voiceModel: 'x' })).toBe(false);
  });

  it('derives the realtime URL from the Base URL', () => {
    const profile = { baseUrl: 'https://api.openai.com/v1/' };
    expect(profileRealtimeUrl(profile)).toBe(
      'wss://api.openai.com/v1/realtime?intent=transcription',
    );
    expect(profileRealtimeUrl({ baseUrl: 'http://localhost:8080/v1' })).toBe(
      'ws://localhost:8080/v1/realtime?intent=transcription',
    );
  });

  it('points Gemini Live at the API host of the OpenAI-compatible Base URL', () => {
    expect(profileGeminiLiveUrl(createLlmProfile('gemini'))).toBe(
      'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent',
    );
  });

  it('keeps voice settings through a save and fills them in for older profiles', async () => {
    const profile = {
      ...createLlmProfile('openai-responses'),
      voiceModel: 'gpt-4o-transcribe',
    };
    await saveSettings({
      llmProfiles: [profile],
      defaultLlmProfileId: profile.id,
      voiceAutoSend: true,
    });
    const settings = await loadSettings();
    expect(settings.llmProfiles[0]?.voiceModel).toBe('gpt-4o-transcribe');
    expect(settings.voiceAutoSend).toBe(true);

    const legacy: Record<string, unknown> = { ...profile };
    delete legacy.voiceModel;
    await chrome.storage.local.set({
      'arlo:settings': { llmProfiles: [legacy], defaultLlmProfileId: legacy.id },
    });
    const migrated = await loadSettings();
    expect(migrated.llmProfiles[0]?.voiceModel).toBe('');
    expect(migrated.voiceAutoSend).toBe(false);
  });

  it('switches voice off for profiles saved with the removed record-then-transcribe mode', async () => {
    const profile = {
      ...createLlmProfile('openai-responses'),
      voiceMode: 'stt',
      voiceModel: 'whisper-1',
    };
    await chrome.storage.local.set({
      'arlo:settings': { llmProfiles: [profile], defaultLlmProfileId: profile.id },
    });
    expect((await loadSettings()).llmProfiles[0]?.voiceModel).toBe('');
  });
});

describe('Traditional Chinese output', () => {
  it('converts Simplified to Traditional with Taiwan wording', async () => {
    const convert = await loadTraditionalConverter();
    expect(convert('请帮我打开这个页面')).toBe('請幫我開啟這個頁面');
    expect(convert('软件')).toBe('軟體');
  });

  it('leaves Traditional, English and mixed text alone', async () => {
    const convert = await loadTraditionalConverter();
    expect(convert('請幫我打開這個頁面')).toBe('請幫我打開這個頁面');
    // 里 and 面 exist in both scripts; Traditional text must not be rewritten.
    expect(convert('請問幾公里')).toBe('請問幾公里');
    expect(convert('open the settings')).toBe('open the settings');
    expect(convert('幫我 summarize 這一頁')).toBe('幫我 summarize 這一頁');
  });
});
