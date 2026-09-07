import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLlmProfile, saveSettings } from '../src/shared/settings';
import { runLocalTurn } from '../src/sidepanel/local-agent';
import type * as LocalAgentModule from '../src/sidepanel/local-agent';
import type { LocalTurnHandlers } from '../src/sidepanel/local-agent';
import { useChat } from '../src/sidepanel/useChat';

vi.mock('../src/sidepanel/local-agent', async (importOriginal) => ({
  ...(await importOriginal<typeof LocalAgentModule>()),
  runLocalTurn: vi.fn(),
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
    permissions: { contains: vi.fn().mockResolvedValue(true), request: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** The panel is usable only once Chrome has granted the profile's origin. */
async function readyChat() {
  const { result } = renderHook(() => useChat());
  await waitFor(() => expect(result.current.status).toBe('ready'));
  return result;
}

const lastReply = (result: { current: ReturnType<typeof useChat> }) =>
  result.current.session.messages.at(-1);

describe('a streamed turn in the panel', () => {
  it('replaces the reply with each snapshot and settles when the turn ends', async () => {
    let handlers: LocalTurnHandlers | undefined;
    let finish: (() => void) | undefined;
    vi.mocked(runLocalTurn).mockImplementation(
      async (_profile, _windowId, _prompt, _history, next) => {
        handlers = next;
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return { history: [] };
      },
    );

    const result = await readyChat();
    void act(() => void result.current.send('open gmail'));
    await waitFor(() => expect(handlers).toBeDefined());

    // Snapshots are cumulative, not deltas — each one replaces the last.
    act(() => handlers!.onText({ id: 'm1', text: 'Open', completed: false }));
    expect(lastReply(result)?.text).toBe('Open');
    act(() => handlers!.onText({ id: 'm1', text: 'Opening Gmail', completed: false }));
    expect(lastReply(result)?.text).toBe('Opening Gmail');
    expect(lastReply(result)?.streaming).toBe(true);

    act(() => handlers!.onText({ id: 'm1', text: 'Opening Gmail.', completed: true }));
    await act(async () => {
      finish!();
    });
    await waitFor(() => expect(lastReply(result)?.streaming).toBe(false));
    expect(lastReply(result)?.text).toBe('Opening Gmail.');
    expect(lastReply(result)?.failed).toBeFalsy();
  });

  it('keeps an error reported after a partial reply, and marks it failed', async () => {
    vi.mocked(runLocalTurn).mockImplementation(
      async (_profile, _windowId, _prompt, _history, next) => {
        next.onText({ id: 'm1', text: 'Looking at the page', completed: false });
        next.onError('The model endpoint returned HTTP 429.');
        return { history: [] };
      },
    );

    const result = await readyChat();
    await act(() => result.current.send('summarise this'));

    await waitFor(() => expect(lastReply(result)?.streaming).toBe(false));
    // The partial answer survives; the reason is appended rather than replacing it.
    expect(lastReply(result)?.text).toBe(
      'Looking at the page\n\nThe model endpoint returned HTTP 429.',
    );
    expect(lastReply(result)?.failed).toBe(true);
  });

  it('surfaces a thrown turn as the reply, and carries the thread into the next one', async () => {
    vi.mocked(runLocalTurn).mockRejectedValueOnce(
      new Error('Arlo speaks the OpenAI wire formats.'),
    );
    const result = await readyChat();
    await act(() => result.current.send('hi'));
    await waitFor(() => expect(lastReply(result)?.failed).toBe(true));
    expect(lastReply(result)?.text).toBe('Arlo speaks the OpenAI wire formats.');

    vi.mocked(runLocalTurn).mockResolvedValueOnce({ history: [{ role: 'user', content: 'hi' }] });
    await act(() => result.current.send('again'));
    vi.mocked(runLocalTurn).mockResolvedValueOnce({ history: [] });
    await act(() => result.current.send('third'));

    // The thread the previous turn returned is what the next one continues from.
    expect(vi.mocked(runLocalTurn).mock.calls.at(-1)?.[3]).toEqual([
      { role: 'user', content: 'hi' },
    ]);
  });
});

describe('what stops a turn starting', () => {
  it('asks for the model origin before anything can be sent', async () => {
    vi.stubGlobal('chrome', {
      ...chrome,
      windows: { getCurrent: vi.fn().mockResolvedValue({ id: 7 }) },
      permissions: { contains: vi.fn().mockResolvedValue(false), request: vi.fn() },
    });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.status).toBe('no-model-access'));

    await act(() => result.current.send('open gmail'));
    expect(runLocalTurn).not.toHaveBeenCalled();
    expect(result.current.session.messages).toHaveLength(0);
  });
});
