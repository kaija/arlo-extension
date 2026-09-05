/**
 * The bridge runs a coding agent on loopback, so any page in the browser can
 * try to reach it. A bearer token minted at startup is the gate; the Origin
 * check is defence in depth.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';

export function createToken(): string {
  return randomBytes(32).toString('base64url');
}

export function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1];
}

export function tokenMatches(expected: string, presented: string | undefined): boolean {
  if (!presented) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * A browser always sends Origin on a cross-origin request, so a page cannot
 * omit it to slip through. Requests with no Origin at all are non-browser
 * callers (curl, tests) and are still gated by the token.
 */
export function originAllowed(origin: string | undefined, allowed: readonly string[]): boolean {
  if (!origin) return true;
  if (allowed.length === 0) return origin.startsWith('chrome-extension://');
  return allowed.includes(origin);
}
