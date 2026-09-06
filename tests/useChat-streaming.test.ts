import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLlmProfile, saveSettings } from '../src/shared/settings';
import { createSession, streamTurn } from '../src/sidepanel/bridge-client';
import type * as BridgeClientModule from '../src/sidepanel/bridge-client';
import type { TurnHandlers } from '../src/sidepanel/bridge-client';
import { useChat } from '../src/sidepanel/useChat';

vi.mock('../src/sidepanel/bridge-client', async (importOriginal) => ({
  ...(await importOriginal<typeof BridgeClientModule>()),
  probeBridge: vi.fn().mockResolvedValue('ok'),
  createSession: vi.fn().mockResolvedValue('chat-session'),
  streamTurn: vi.fn(),
}));

beforeEach(async () => {
  const profile = {
    ...createLlmProfile('openai-responses'),
    model: 'test-model',
    apiKey: 'test-key',
  };
  await saveSettings({ llmProfiles: [profile], defaultLlmProfileId: profile.id });
  vi.stubGlobal('chrome', {
    ...chrome,
    windows: { getCurrent: vi.fn().mockResolvedValue({ id: 7 }) },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useChat streaming', () => {
  it('renders each completed line while the stream remains open and replaces prior snapshots', async () => {
    let handlers: TurnHandlers | undefined;
    let finishStream: (() => void) | undefined;
    vi.mocked(streamTurn).mockImplementation(
      async (_config, _sessionId, _prompt, _profile, nextHandlers) => {
        handlers = nextHandlers;
        await new Promise<void>((resolve) => {
          finishStream = resolve;
        });
      },
    );

    const { result } = renderHook(useChat);
    await waitFor(() => expect(result.current.status).toBe('ok'));

    let turn!: Promise<void>;
    act(() => {
      turn = result.current.send('Write two lines');
    });
    await waitFor(() => expect(handlers).toBeDefined());
    const currentHandlers = handlers;
    if (!currentHandlers) throw new Error('Expected stream handlers.');

    act(() => {
      currentHandlers.onText({
        id: 'agent-message-1',
        text: 'First line\nunfinished tail',
        completed: false,
      });
    });
    expect(result.current.session.messages.at(-1)).toMatchObject({
      role: 'assistant',
      text: 'First line\n',
      streaming: true,
    });
    expect(result.current.session.running).toBe(true);

    act(() => {
      currentHandlers.onText({
        id: 'agent-message-1',
        text: 'First line\nSecond line\nunfinished tail',
        completed: false,
      });
    });
    expect(result.current.session.messages.at(-1)?.text).toBe('First line\nSecond line\n');

    act(() => {
      currentHandlers.onText({
        id: 'agent-message-1',
        text: 'First line\nSecond line\nfinal tail',
        completed: true,
      });
    });
    expect(result.current.session.messages.at(-1)).toMatchObject({
      text: 'First line\nSecond line\nfinal tail',
      streaming: true,
    });

    const finish = finishStream;
    if (!finish) throw new Error('Expected the stream to be pending.');
    act(finish);
    await act(async () => {
      await turn;
    });

    expect(createSession).toHaveBeenCalledWith(expect.anything());
    expect(result.current.session.messages.at(-1)).toMatchObject({
      text: 'First line\nSecond line\nfinal tail',
      streaming: false,
    });
    expect(result.current.session.running).toBe(false);
  });

  it('flushes a final partial line when a compatible bridge ends without item.completed', async () => {
    let handlers: TurnHandlers | undefined;
    let finishStream: (() => void) | undefined;
    vi.mocked(streamTurn).mockImplementation(
      async (_config, _sessionId, _prompt, _profile, nextHandlers) => {
        handlers = nextHandlers;
        await new Promise<void>((resolve) => {
          finishStream = resolve;
        });
      },
    );

    const { result } = renderHook(useChat);
    await waitFor(() => expect(result.current.status).toBe('ok'));

    let turn!: Promise<void>;
    act(() => {
      turn = result.current.send('Write one line');
    });
    await waitFor(() => expect(handlers).toBeDefined());
    const currentHandlers = handlers;
    if (!currentHandlers) throw new Error('Expected stream handlers.');

    act(() => {
      currentHandlers.onText({
        id: 'agent-message-1',
        text: 'Visible line\nfinal tail',
        completed: false,
      });
    });
    expect(result.current.session.messages.at(-1)?.text).toBe('Visible line\n');

    const finish = finishStream;
    if (!finish) throw new Error('Expected the stream to be pending.');
    act(finish);
    await act(async () => {
      await turn;
    });

    expect(result.current.session.messages.at(-1)).toMatchObject({
      text: 'Visible line\nfinal tail',
      streaming: false,
    });
  });

  it('keeps an error reported after a streamed partial line', async () => {
    let handlers: TurnHandlers | undefined;
    let finishStream: (() => void) | undefined;
    vi.mocked(streamTurn).mockImplementation(
      async (_config, _sessionId, _prompt, _profile, nextHandlers) => {
        handlers = nextHandlers;
        await new Promise<void>((resolve) => {
          finishStream = resolve;
        });
      },
    );

    const { result } = renderHook(useChat);
    await waitFor(() => expect(result.current.status).toBe('ok'));

    let turn!: Promise<void>;
    act(() => {
      turn = result.current.send('Write one line');
    });
    await waitFor(() => expect(handlers).toBeDefined());
    const currentHandlers = handlers;
    if (!currentHandlers) throw new Error('Expected stream handlers.');

    act(() => {
      currentHandlers.onText({
        id: 'agent-message-1',
        text: 'Visible line\nfinal tail',
        completed: false,
      });
      currentHandlers.onError('The bridge stopped.');
    });
    expect(result.current.session.messages.at(-1)).toMatchObject({
      text: 'Visible line\nfinal tail\n\nThe bridge stopped.',
      failed: true,
      streaming: true,
    });

    const finish = finishStream;
    if (!finish) throw new Error('Expected the stream to be pending.');
    act(finish);
    await act(async () => {
      await turn;
    });

    expect(result.current.session.messages.at(-1)).toMatchObject({
      text: 'Visible line\nfinal tail\n\nThe bridge stopped.',
      failed: true,
      streaming: false,
    });
  });
});
