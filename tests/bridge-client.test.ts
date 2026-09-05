import { describe, expect, it } from 'vitest';

import {
  agentMessageText,
  bridgeOriginPattern,
  parseSseChunk,
  turnError,
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

  it('takes prose from an agent message and ignores the agent’s other work', () => {
    expect(
      agentMessageText(frame('item.completed', { item: { type: 'agent_message', text: 'Hello' } })),
    ).toBe('Hello');
    // Command runs and file edits are activity, not the reply.
    expect(
      agentMessageText(frame('item.completed', { item: { type: 'command_execution' } })),
    ).toBeNull();
    expect(agentMessageText(frame('turn.completed', {}))).toBeNull();
  });

  it('surfaces both shapes of failure Codex reports', () => {
    expect(turnError(frame('error', { message: '401 Unauthorized' }))).toBe('401 Unauthorized');
    expect(turnError(frame('turn.failed', { error: { message: 'ran out of context' } }))).toBe(
      'ran out of context',
    );
    expect(turnError(frame('turn.failed', { error: 'plain string' }))).toBe('plain string');
    expect(turnError(frame('item.completed', {}))).toBeNull();
  });
});

describe('reaching the bridge', () => {
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
