import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLlmProfile } from '../src/shared/settings';
import type { LocalAgentHistory } from '../src/sidepanel/local-agent';

const run = vi.hoisted(() => vi.fn());
const tool = vi.hoisted(() => vi.fn((options: unknown) => options));
const setTracingDisabled = vi.hoisted(() => vi.fn());
const getModel = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'stub-model' }));
const OpenAIProvider = vi.hoisted(() =>
  vi.fn(function () {
    return { getModel };
  }),
);
const OpenAIClient = vi.hoisted(() =>
  vi.fn(function () {
    return { stub: 'client' };
  }),
);
const readCurrentTab = vi.hoisted(() => vi.fn());
const openAgentTab = vi.hoisted(() => vi.fn());

vi.mock('@openai/agents', () => ({
  Agent: class {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  },
  run,
  tool,
  setTracingDisabled,
}));
vi.mock('@openai/agents-openai', () => ({ OpenAIProvider }));
vi.mock('openai', () => ({ default: OpenAIClient }));
vi.mock('../src/sidepanel/page-reader', () => ({ readCurrentTab }));
vi.mock('../src/sidepanel/tab-opener', () => ({ openAgentTab }));

const { runLocalTurn } = await import('../src/sidepanel/local-agent');

afterEach(() => vi.clearAllMocks());

/** A streamed run: raw text deltas, then a settled history. */
function stream(deltas: string[], history: unknown[] = [], finalOutput?: string) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const delta of deltas) {
        yield { type: 'raw_model_stream_event', data: { type: 'output_text_delta', delta } };
      }
      // Noise the panel must ignore rather than render.
      yield { type: 'run_item_stream_event', name: 'tool_called', item: {} };
    },
    completed: Promise.resolve(),
    finalOutput,
    history,
  };
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    ...createLlmProfile('openai-chat-completions'),
    baseUrl: 'https://api.example.com/v1/',
    apiKey: 'test-key',
    model: 'test-model',
    ...overrides,
  };
}

describe('the in-panel agent turn', () => {
  it('streams growing snapshots and returns the thread to continue from', async () => {
    run.mockResolvedValue(stream(['Open', 'ing G', 'mail.'], [{ role: 'assistant' }]));
    const onText = vi.fn();

    const result = await runLocalTurn(profile(), 7, 'open gmail', [], {
      onText,
      onError: vi.fn(),
    });

    // Each update is a complete snapshot, not a delta — the transcript replaces.
    expect(onText.mock.calls.map(([m]) => m.text)).toEqual([
      'Open',
      'Opening G',
      'Opening Gmail.',
      'Opening Gmail.',
    ]);
    expect(onText.mock.calls.at(-1)?.[0].completed).toBe(true);
    expect(result.history).toEqual([{ role: 'assistant' }]);
    // Nothing about the user's browsing should leave for a third destination.
    expect(setTracingDisabled).toHaveBeenCalledWith(true);
  });

  it('continues an existing thread instead of restarting it', async () => {
    run.mockResolvedValue(stream(['ok']));
    const history = [{ role: 'user', content: 'first' }] as unknown as LocalAgentHistory;

    await runLocalTurn(profile(), 7, 'second', history, { onText: vi.fn(), onError: vi.fn() });

    expect(run.mock.calls[0]?.[1]).toEqual([...history, { role: 'user', content: 'second' }]);
  });

  it('points the provider at the profile, and names the wire format', async () => {
    run.mockResolvedValue(stream(['ok']));

    await runLocalTurn(profile({ apiContract: 'openai-responses' }), 7, 'hi', [], {
      onText: vi.fn(),
      onError: vi.fn(),
    });

    expect(OpenAIProvider).toHaveBeenCalledWith({
      useResponses: true,
      openAIClient: { stub: 'client' },
    });
    expect(OpenAIClient).toHaveBeenCalledWith({
      apiKey: 'test-key',
      // The trailing slash would double up against the SDK's own path joining.
      baseURL: 'https://api.example.com/v1',
      // Without this the client refuses to run in a page at all.
      dangerouslyAllowBrowser: true,
    });
    expect(getModel).toHaveBeenCalledWith('test-model');
  });

  it('refuses a profile whose wire format the SDK cannot speak', async () => {
    await expect(
      runLocalTurn(profile({ apiContract: 'anthropic-messages' }), 7, 'hi', [], {
        onText: vi.fn(),
        onError: vi.fn(),
      }),
    ).rejects.toThrow(/OpenAI wire formats/);
    expect(run).not.toHaveBeenCalled();
  });

  it('binds both tools to the panel window, never to a tool argument', async () => {
    run.mockResolvedValue(stream(['ok']));
    readCurrentTab.mockResolvedValue({ ok: true });
    openAgentTab.mockResolvedValue({ ok: true });

    await runLocalTurn(profile(), 23, 'hi', [], { onText: vi.fn(), onError: vi.fn() });

    const tools = tool.mock.calls.map(
      ([options]) => options as { name: string; execute: (input: unknown) => Promise<string> },
    );
    expect(tools.map((t) => t.name)).toEqual(['read_current_tab', 'open_new_tab']);

    // A strict schema cannot mark a field optional, so the model sends nulls.
    // They must be dropped, not forwarded into the panel's own parsers.
    await tools[0]!.execute({ level: 'compact', selector: null, offset: 0, maxChars: 2000 });
    expect(readCurrentTab).toHaveBeenCalledWith(23, {
      level: 'compact',
      offset: 0,
      maxChars: 2000,
    });

    await tools[1]!.execute({ url: 'https://example.com', active: true });
    expect(openAgentTab).toHaveBeenCalledWith(23, { url: 'https://example.com', active: true });
  });
});
