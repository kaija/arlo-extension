import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { geminiFetch, resetGeminiSignatures } from '../src/sidepanel/gemini-fetch';

const fetchMock = vi.fn();

function sse(...chunks: unknown[]) {
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function followUp(toolCallId: string) {
  return JSON.stringify({
    model: 'gemini-3-flash',
    messages: [
      { role: 'user', content: 'open example' },
      {
        role: 'assistant',
        tool_calls: [
          { id: toolCallId, type: 'function', function: { name: 'open_new_tab', arguments: '{}' } },
        ],
      },
      { role: 'tool', tool_call_id: toolCallId, content: '{}' },
    ],
  });
}

function sentToolCall(callIndex: number) {
  const body = JSON.parse(fetchMock.mock.calls[callIndex]![1].body as string);
  return body.messages[1].tool_calls[0];
}

describe('Gemini thought signatures', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    resetGeminiSignatures();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('replays a signature streamed on a tool call, and hands the SDK the stream intact', async () => {
    fetchMock.mockResolvedValueOnce(
      sse({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'open_new_tab', arguments: '{}' },
                  extra_content: { google: { thought_signature: 'SIG-1' } },
                },
              ],
            },
          },
        ],
      }),
    );
    const response = await geminiFetch('https://x/chat/completions', {
      method: 'POST',
      body: '{}',
    });
    // The caller still gets a readable, unmodified body.
    expect(await response.text()).toContain('SIG-1');

    fetchMock.mockResolvedValueOnce(sse({ choices: [{ delta: { content: 'done' } }] }));
    await geminiFetch('https://x/chat/completions', { method: 'POST', body: followUp('call_1') });

    expect(sentToolCall(1).extra_content).toEqual({ google: { thought_signature: 'SIG-1' } });
  });

  it('reads signatures from a non-streaming response too', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_2',
                    type: 'function',
                    function: { name: 'open_new_tab', arguments: '{}' },
                    extra_content: { google: { thought_signature: 'SIG-2' } },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await geminiFetch('https://x/chat/completions', { method: 'POST', body: '{}' });
    fetchMock.mockResolvedValueOnce(sse());
    await geminiFetch('https://x/chat/completions', { method: 'POST', body: followUp('call_2') });

    expect(sentToolCall(1).extra_content.google.thought_signature).toBe('SIG-2');
  });

  it('falls back to the documented skip value when no signature was seen', async () => {
    fetchMock.mockResolvedValueOnce(sse());
    await geminiFetch('https://x/chat/completions', { method: 'POST', body: followUp('unknown') });

    expect(sentToolCall(0).extra_content.google.thought_signature).toBe(
      'skip_thought_signature_validator',
    );
  });

  it('leaves a request without tool calls untouched', async () => {
    fetchMock.mockResolvedValueOnce(sse());
    const body = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] });
    await geminiFetch('https://x/chat/completions', { method: 'POST', body });

    expect(fetchMock.mock.calls[0]![1].body).toBe(body);
  });
});
