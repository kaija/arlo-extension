import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  agentMessageText,
  bridgeOriginPattern,
  parseSseChunk,
  probeBridge,
  turnError,
  streamTurn,
  type SseFrame,
} from '../src/sidepanel/bridge-client';

describe('SSE parsing', () => {
  it('emits a frame only once its terminator has arrived', () => {
    // A chunk can split anywhere, so a half-delivered frame must be held back
    // rather than parsed into something wrong.
    const first = parseSseChunk('event: turn.started\ndata: {"type":"turn.star');
    expect(first.frames).toEqual([]);

    const second = parseSseChunk(`${first.rest}ted"}\n\n`);
    expect(second.frames).toEqual([{ event: 'turn.started', data: { type: 'turn.started' } }]);
    expect(second.rest).toBe('');
  });

  it('reads several frames out of one chunk', () => {
    const { frames } = parseSseChunk('event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\n');
    expect(frames.map((f) => f.event)).toEqual(['a', 'b']);
    expect(frames[1]?.data).toEqual({ n: 2 });
  });

  it('rejoins a data payload split across lines', () => {
    const { frames } = parseSseChunk('event: x\ndata: {"a":\ndata: 1}\n\n');
    expect(frames[0]?.data).toEqual({ a: 1 });
  });

  it('keeps unparseable data as text rather than dropping the frame', () => {
    const { frames } = parseSseChunk('event: note\ndata: plain words\n\n');
    expect(frames[0]).toEqual({ event: 'note', data: 'plain words' });
  });
});

describe('reading Codex events', () => {
  const frame = (event: string, data: unknown): SseFrame => ({ event, data });

  it('takes cumulative prose snapshots from agent messages and ignores the agent’s other work', () => {
    expect(
      agentMessageText(
        frame('item.updated', {
          item: { id: 'message-1', type: 'agent_message', text: 'Hello' },
        }),
      ),
    ).toEqual({ id: 'message-1', text: 'Hello', completed: false });
    expect(
      agentMessageText(
        frame('item.completed', {
          item: { id: 'message-1', type: 'agent_message', text: 'Hello, world.' },
        }),
      ),
    ).toEqual({ id: 'message-1', text: 'Hello, world.', completed: true });
    // Command runs and file edits are activity, not the reply.
    expect(
      agentMessageText(
        frame('item.completed', { item: { id: 'command-1', type: 'command_execution' } }),
      ),
    ).toBeNull();
    expect(agentMessageText(frame('turn.completed', {}))).toBeNull();
  });

  it('surfaces both shapes of failure Codex reports', () => {
    expect(turnError(frame('error', { error: 'Bridge failed' }))).toBe('Bridge failed');
    expect(turnError(frame('error', { message: '401 Unauthorized' }))).toBe('401 Unauthorized');
    expect(turnError(frame('turn.failed', { error: { message: 'ran out of context' } }))).toBe(
      'ran out of context',
    );
    expect(turnError(frame('turn.failed', { error: 'plain string' }))).toBe('plain string');
    expect(turnError(frame('item.completed', {}))).toBeNull();
  });
});

describe('page read requests during a streamed turn', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers browser requests and then continues reading the agent response', async () => {
    const requestId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const options = { level: 'detailed', offset: 0, maxChars: 12000 };
    const result = {
      ok: false as const,
      error: { code: 'PAGE_ACCESS_REQUIRED', message: 'Click Arlo.' },
    };
    const encoder = new TextEncoder();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `event: page.read\ndata: ${JSON.stringify({ requestId, options })}\n\n`,
                ),
              );
              controller.enqueue(
                encoder.encode(
                  'event: item.completed\ndata: {"item":{"id":"message-1","type":"agent_message","text":"Please grant access."}}\n\n',
                ),
              );
              controller.close();
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const onPageRead = vi.fn().mockResolvedValue(result);
    const onText = vi.fn();
    await streamTurn(
      { url: 'http://127.0.0.1:4319', token: 'test' },
      'session',
      'Read this page',
      {},
      { onText, onError: vi.fn(), onPageRead },
    );
    expect(onPageRead).toHaveBeenCalledWith(options);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toMatchObject({
      capabilities: { pageReader: 1 },
    });
    expect(fetchMock.mock.calls[1]?.[0].pathname).toBe(
      `/sessions/session/page-results/${requestId}`,
    );
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual(result);
    expect(fetchMock.mock.calls[1]?.[1].headers.authorization).toBe('Bearer test');
    expect(onText).toHaveBeenCalledWith({
      id: 'message-1',
      text: 'Please grant access.',
      completed: true,
    });
  });

  it('reports an old panel without a reader and tolerates replies to expired requests', async () => {
    const data = { requestId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', options: {} };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(`event: page.read\ndata: ${JSON.stringify(data)}\n\n`))
      .mockResolvedValueOnce(new Response('{}', { status: 410 }));
    vi.stubGlobal('fetch', fetchMock);
    await streamTurn(
      { url: 'http://127.0.0.1:4319', token: '' },
      'session',
      'Read',
      {},
      { onText: vi.fn(), onError: vi.fn() },
    );
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toMatchObject({
      ok: false,
      error: { code: 'READER_UNAVAILABLE' },
    });
  });
});

describe('assistant snapshots during a streamed turn', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards each item.updated snapshot before the completed snapshot without duplicates', async () => {
    const encoder = new TextEncoder();
    const onText = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'event: item.started\ndata: {"item":{"id":"message-1","type":"agent_message","text":""}}\n\n',
                ),
              );
              controller.enqueue(
                encoder.encode(
                  'event: item.updated\ndata: {"item":{"id":"message-1","type":"agent_message","text":"First line\\n"}}\n\n',
                ),
              );
              controller.enqueue(
                encoder.encode(
                  'event: item.updated\ndata: {"item":{"id":"message-1","type":"agent_message","text":"First line\\nSecond line"}}\n\n',
                ),
              );
              controller.enqueue(
                encoder.encode(
                  'event: item.completed\ndata: {"item":{"id":"message-1","type":"agent_message","text":"First line\\nSecond line."}}\n\n',
                ),
              );
              controller.close();
            },
          }),
        ),
      ),
    );

    await streamTurn(
      { url: 'http://127.0.0.1:4319', token: '' },
      'session',
      'Say hello',
      {},
      { onText, onError: vi.fn() },
    );

    expect(onText.mock.calls.map(([snapshot]) => snapshot)).toEqual([
      { id: 'message-1', text: '', completed: false },
      { id: 'message-1', text: 'First line\n', completed: false },
      { id: 'message-1', text: 'First line\nSecond line', completed: false },
      { id: 'message-1', text: 'First line\nSecond line.', completed: true },
    ]);
  });
});

describe('reaching the bridge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not call an old bridge connected when it cannot register the page reader', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true, workspaceRoot: '/sessions' }))),
    );
    expect(await probeBridge({ url: 'http://127.0.0.1:4319', token: '' })).toBe('upgrade-required');
  });

  it('accepts a bridge advertising the compatible page reader', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: true, capabilities: { pageReader: 1 } })),
        ),
    );
    expect(await probeBridge({ url: 'http://127.0.0.1:4319', token: '' })).toBe('ok');
  });

  it('derives the host pattern Chrome needs, without the port', () => {
    // Match patterns carry no port, so including one makes the pattern invalid.
    expect(bridgeOriginPattern('http://127.0.0.1:4319')).toBe('http://127.0.0.1/*');
    expect(bridgeOriginPattern('http://localhost:9999/')).toBe('http://localhost/*');
    expect(bridgeOriginPattern('https://bridge.example:8443')).toBe('https://bridge.example/*');
  });

  it('has no pattern for an address it cannot use', () => {
    for (const bad of ['', 'not a url', 'ftp://127.0.0.1', 'file:///tmp']) {
      expect(bridgeOriginPattern(bad)).toBeNull();
    }
  });
});
