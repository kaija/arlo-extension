// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { bearerToken, createToken, originAllowed, tokenMatches } from '../bridge/src/auth.ts';

describe('bridge auth', () => {
  it('accepts only the exact token', () => {
    const token = createToken();
    expect(token.length).toBeGreaterThan(32);
    expect(tokenMatches(token, token)).toBe(true);
    expect(tokenMatches(token, `${token}x`)).toBe(false);
    expect(tokenMatches(token, undefined)).toBe(false);
    expect(tokenMatches(token, '')).toBe(false);
  });

  it('reads the bearer scheme case-insensitively', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });

  it('lets the extension through and keeps other pages out', () => {
    // A browser always sends Origin cross-origin, so a page cannot omit it to
    // slip past; a missing Origin is a non-browser caller, still token-gated.
    expect(originAllowed('chrome-extension://abc', [])).toBe(true);
    expect(originAllowed('https://evil.example', [])).toBe(false);
    expect(originAllowed(undefined, [])).toBe(true);
    expect(originAllowed('https://ok.example', ['https://ok.example'])).toBe(true);
    expect(originAllowed('chrome-extension://abc', ['https://ok.example'])).toBe(false);
  });
});
