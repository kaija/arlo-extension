import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listModels } from '../src/background/llm-client';
import { createLlmProfile, type LlmApiContract } from '../src/shared/settings';

const fetchMock = vi.fn();

function profile(apiContract: LlmApiContract) {
  return {
    ...createLlmProfile(apiContract),
    model: 'test-model',
    apiKey: 'test-secret',
  };
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('model discovery', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads and sorts OpenAI model ids with bearer authentication', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'z-model' }, { id: 'a-model' }] }));
    const result = await listModels(profile('openai-responses'));
    expect(result).toMatchObject({ status: 'available', models: ['a-model', 'z-model'] });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-secret' }),
      }),
    );
  });

  it('uses Anthropic headers and treats a missing model endpoint as usable', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: 'Not implemented' } }, { status: 404 }),
    );
    const result = await listModels(profile('anthropic-messages'));
    expect(result.status).toBe('unavailable');
    expect(result.message).toContain('still enter a model ID');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'test-secret',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
  });
});
