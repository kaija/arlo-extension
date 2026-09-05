import { describe, expect, it } from 'vitest';

import { newId, sendToBackground } from '../src/shared/messages';
import { createLlmProfile } from '../src/shared/settings';

describe('messaging', () => {
  it('forwards a request to the background', async () => {
    const profile = createLlmProfile('openai-responses');
    await sendToBackground({ type: 'llm:list-models', profile });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'llm:list-models', profile });
  });

  it('mints prefixed, unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId('msg')));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^msg_[0-9a-f]{8}$/);
  });
});
