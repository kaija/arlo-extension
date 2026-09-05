// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { decideClient } from '../bridge/src/client-pin.ts';

const EXT = 'chrome-extension://aaaabbbbccccddddeeeeffffgggghhhh';
const OTHER = 'chrome-extension://zzzzyyyyxxxxwwwwvvvvuuuuttttssss';

describe('who may drive the bridge', () => {
  it('pairs with the first extension that connects, then only that one', () => {
    const first = decideClient(EXT, null, []);
    expect(first).toEqual({ allowed: true, pin: EXT });

    expect(decideClient(EXT, EXT, []).allowed).toBe(true);
    expect(decideClient(OTHER, EXT, [])).toEqual({
      allowed: false,
      reason: 'another-client',
    });
  });

  it('keeps web pages out however they ask', () => {
    // A page cannot forge Origin, so this is the check that actually holds.
    expect(decideClient('https://evil.example', EXT, []).allowed).toBe(false);
    expect(decideClient('http://localhost:3000', null, []).allowed).toBe(false);
  });

  it('refuses a request with no Origin at all', () => {
    // A browser always sends one; anything else is not the panel. Allowing it
    // was how a local script could have reached the agent.
    expect(decideClient(undefined, EXT, [])).toEqual({ allowed: false, reason: 'no-origin' });
  });

  it('still honours explicitly configured origins, without pinning them', () => {
    const dev = decideClient('http://localhost:5199', EXT, ['http://localhost:5199']);
    expect(dev).toEqual({ allowed: true });
  });
});
