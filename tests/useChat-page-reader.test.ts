import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLlmProfile, saveSettings } from '../src/shared/settings';
import { createSession, streamTurn } from '../src/sidepanel/bridge-client';
import type * as BridgeClientModule from '../src/sidepanel/bridge-client';
import { readCurrentTab } from '../src/sidepanel/page-reader';
import { useChat } from '../src/sidepanel/useChat';

vi.mock('../src/sidepanel/bridge-client', async (importOriginal) => ({
  ...(await importOriginal<typeof BridgeClientModule>()),
  probeBridge: vi.fn().mockResolvedValue('ok'),
  createSession: vi.fn().mockResolvedValue('chat-session'),
  streamTurn: vi.fn(),
}));
vi.mock('../src/sidepanel/page-reader', () => ({ readCurrentTab: vi.fn() }));

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
  vi.mocked(readCurrentTab).mockResolvedValue({
    ok: false,
    error: { code: 'NO_ACTIVE_TAB', message: 'No tab.' },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Arlo agent page-reader integration', () => {
  it('supplies the reader only on demand and keeps it bound to the panel window across turns', async () => {
    vi.mocked(streamTurn).mockImplementation(async (_config, _id, _prompt, _profile, handlers) => {
      expect(readCurrentTab).not.toHaveBeenCalled();
      await handlers.onPageRead?.({ level: 'detailed' });
      handlers.onText('The page could not be read.');
    });
    const { result } = renderHook(useChat);
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.profile?.model).toBe('test-model');
    expect(readCurrentTab).not.toHaveBeenCalled();
    await act(() => result.current.send('Inspect this form'));
    expect(readCurrentTab).toHaveBeenCalledWith(7, { level: 'detailed' });
    expect(result.current.session.messages.at(-1)?.text).toBe('The page could not be read.');
    vi.mocked(streamTurn).mockResolvedValueOnce();
    await act(() => result.current.send('Try again'));
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(streamTurn).toHaveBeenLastCalledWith(
      expect.anything(),
      'chat-session',
      'Try again',
      expect.objectContaining({ model: 'test-model' }),
      expect.anything(),
      expect.any(AbortSignal),
    );
  });

  it.each(['reset', 'unmount'] as const)(
    'cancels a pending turn on %s without leaking errors into the next chat',
    async (action) => {
      let signal: AbortSignal | undefined;
      vi.mocked(streamTurn).mockImplementation(
        async (_config, _id, _prompt, _profile, _handlers, currentSignal) => {
          signal = currentSignal;
          await new Promise<void>((_resolve, reject) => {
            currentSignal?.addEventListener('abort', () => reject(currentSignal.reason), {
              once: true,
            });
          });
        },
      );
      const { result, unmount } = renderHook(useChat);
      await waitFor(() => expect(result.current.status).toBe('ok'));
      let turn: Promise<void>;
      act(() => {
        turn = result.current.send('Read this page');
      });
      await waitFor(() => expect(streamTurn).toHaveBeenCalled());
      await act(() => result.current.send('Duplicate turn'));
      expect(streamTurn).toHaveBeenCalledTimes(1);
      if (action === 'reset') act(() => result.current.reset());
      else unmount();
      await act(async () => {
        await turn;
      });
      expect(signal?.aborted).toBe(true);
      if (action === 'reset') {
        expect(result.current.session).toMatchObject({ id: null, messages: [], running: false });
        expect(result.current.error).toBeNull();
      }
    },
  );
});
