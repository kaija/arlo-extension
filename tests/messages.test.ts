import { describe, expect, it, vi } from 'vitest';

import { newId, sendToBackground, sendToContent } from '../src/shared/messages';

describe('messaging', () => {
  it('forwards a request to the background', async () => {
    await sendToBackground({ type: 'run:get', tabId: 7 });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'run:get', tabId: 7 });
  });

  it('turns a missing content script into a failed response, not a throw', async () => {
    Object.assign(chrome, {
      tabs: {
        sendMessage: vi.fn(async () => {
          throw new Error('Could not establish connection.');
        }),
      },
    });

    const response = await sendToContent(3, { type: 'content:ping' });
    expect(response).toEqual({ ok: false, error: 'Could not establish connection.' });
  });

  it('mints prefixed, unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId('step')));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^step_[0-9a-f]{8}$/);
  });
});
