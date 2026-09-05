// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { decideClient, type ClientRequest } from '../bridge/src/client-pin.ts';

const ID = 'aaaabbbbccccddddeeeeffffgggghhhh';
const EXT = `chrome-extension://${ID}`;
const OTHER = 'chrome-extension://zzzzyyyyxxxxwwwwvvvvuuuuttttssss';

const from = (partial: Partial<ClientRequest>): ClientRequest => ({
  origin: undefined,
  clientId: undefined,
  ...partial,
});

describe('who may drive the bridge', () => {
  it('identifies the panel by its id when Chrome sends no Origin', () => {
    // An extension holding a host permission makes a privileged fetch, which
    // may carry no Origin at all. Requiring one is what broke pairing.
    const first = decideClient(from({ clientId: ID }), null, []);
    expect(first).toEqual({ allowed: true, pin: EXT });
    expect(decideClient(from({ clientId: ID }), EXT, []).allowed).toBe(true);
  });

  it('identifies it by Origin when Chrome does send one', () => {
    expect(decideClient(from({ origin: EXT }), null, [])).toEqual({ allowed: true, pin: EXT });
    expect(decideClient(from({ origin: EXT }), EXT, []).allowed).toBe(true);
  });

  it('pairs with one extension and refuses the next', () => {
    expect(decideClient(from({ origin: OTHER }), EXT, [])).toEqual({
      allowed: false,
      reason: 'another-client',
    });
  });

  it('keeps web pages out even when they claim to be the panel', () => {
    // A page always carries an Origin we refuse, so a forged id buys nothing.
    expect(decideClient(from({ origin: 'https://evil.example', clientId: ID }), null, [])).toEqual({
      allowed: false,
      reason: 'not-a-client',
    });
  });

  it('refuses a caller that identifies itself in neither way', () => {
    expect(decideClient(from({}), null, [])).toEqual({ allowed: false, reason: 'unidentified' });
    expect(decideClient(from({ clientId: 'not-an-id' }), null, [])).toEqual({
      allowed: false,
      reason: 'unidentified',
    });
  });

  it('still honours an explicitly configured origin, without pinning it', () => {
    expect(
      decideClient(from({ origin: 'http://localhost:5199' }), EXT, ['http://localhost:5199']),
    ).toEqual({
      allowed: true,
    });
  });
});
