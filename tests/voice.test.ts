import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createLlmProfile,
  profileRealtimeUrl,
  profileTranscriptionsEndpoint,
  saveSettings,
  loadSettings,
  voiceEnabled,
} from '../src/shared/settings';
import { transcribeClip } from '../src/sidepanel/voice';

afterEach(() => vi.unstubAllGlobals());

describe('voice settings', () => {
  it('starts with voice off, and only the OpenAI wire formats can turn it on', () => {
    const responses = createLlmProfile('openai-responses');
    expect(responses.voiceMode).toBe('off');
    expect(voiceEnabled(responses)).toBe(false);
    expect(voiceEnabled({ ...responses, voiceMode: 'stt', voiceModel: 'whisper-1' })).toBe(true);
    expect(voiceEnabled({ ...responses, voiceMode: 'stt', voiceModel: ' ' })).toBe(false);
    const gemini = createLlmProfile('gemini');
    expect(voiceEnabled({ ...gemini, voiceMode: 'live', voiceModel: 'x' })).toBe(false);
    const anthropic = createLlmProfile('anthropic-messages');
    expect(voiceEnabled({ ...anthropic, voiceMode: 'stt', voiceModel: 'x' })).toBe(false);
  });

  it('derives the transcription and realtime URLs from the Base URL', () => {
    const profile = { baseUrl: 'https://api.openai.com/v1/' };
    expect(profileTranscriptionsEndpoint(profile)).toBe(
      'https://api.openai.com/v1/audio/transcriptions',
    );
    expect(profileRealtimeUrl(profile)).toBe(
      'wss://api.openai.com/v1/realtime?intent=transcription',
    );
    expect(profileRealtimeUrl({ baseUrl: 'http://localhost:8080/v1' })).toBe(
      'ws://localhost:8080/v1/realtime?intent=transcription',
    );
  });

  it('keeps voice settings through a save and fills them in for older profiles', async () => {
    const profile = {
      ...createLlmProfile('openai-responses'),
      voiceMode: 'live' as const,
      voiceModel: 'gpt-4o-transcribe',
    };
    await saveSettings({
      llmProfiles: [profile],
      defaultLlmProfileId: profile.id,
      voiceAutoSend: true,
    });
    const settings = await loadSettings();
    expect(settings.llmProfiles[0]).toMatchObject({
      voiceMode: 'live',
      voiceModel: 'gpt-4o-transcribe',
    });
    expect(settings.voiceAutoSend).toBe(true);

    const legacy: Record<string, unknown> = { ...profile };
    delete legacy.voiceMode;
    delete legacy.voiceModel;
    await chrome.storage.local.set({
      'arlo:settings': { llmProfiles: [legacy], defaultLlmProfileId: legacy.id },
    });
    const migrated = await loadSettings();
    expect(migrated.llmProfiles[0]).toMatchObject({ voiceMode: 'off', voiceModel: '' });
    expect(migrated.voiceAutoSend).toBe(false);
  });
});

describe('transcribeClip', () => {
  const profile = {
    ...createLlmProfile('openai-responses'),
    apiKey: 'sk-test',
    voiceMode: 'stt' as const,
    voiceModel: 'whisper-1',
  };

  it('posts the clip with the model and key, and returns the text', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: ' hello there ' })));
    vi.stubGlobal('fetch', fetchMock);
    const text = await transcribeClip(profile, new Blob(['x']), 'webm');
    expect(text).toBe('hello there');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect((init.body as FormData).get('model')).toBe('whisper-1');
  });

  it('reports the provider message when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'bad model' } }), { status: 400 }),
      ),
    );
    await expect(transcribeClip(profile, new Blob(['x']), 'webm')).rejects.toThrow(
      'Speech-to-text failed: bad model',
    );
  });
});
