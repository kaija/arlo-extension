import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listModels, requestPlan } from '../src/background/llm-client';
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

describe('planner requests', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  const plan = { steps: [{ title: 'Read the page', action: 'read' }] };
  const page = { url: 'https://example.com', title: 'Example', text: 'Visible text' };

  it('extracts an Anthropic tool call', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: 'tool_use', name: 'submit_plan', input: plan }] }),
    );
    await expect(requestPlan(profile('anthropic-messages'), 'Summarize it', page)).resolves.toEqual(
      plan,
    );
  });

  it('extracts an OpenAI Responses function call and disables storage', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        output: [{ type: 'function_call', name: 'submit_plan', arguments: JSON.stringify(plan) }],
      }),
    );
    await expect(requestPlan(profile('openai-responses'), 'Summarize it', page)).resolves.toEqual(
      plan,
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ store: false, model: 'test-model' });
  });

  it('extracts an OpenAI Chat Completions function call', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              tool_calls: [{ function: { name: 'submit_plan', arguments: JSON.stringify(plan) } }],
            },
          },
        ],
      }),
    );
    await expect(
      requestPlan(profile('openai-chat-completions'), 'Summarize it', page),
    ).resolves.toEqual(plan);
  });
});
