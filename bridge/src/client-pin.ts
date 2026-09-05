/**
 * Who may drive the bridge.
 *
 * A token was the wrong gate. It defended against other local processes, which
 * is a position already lost — anything running code on this machine can invoke
 * `codex` directly — while costing a copy-paste on every restart.
 *
 * The threat worth blocking is another *browser* client: a web page, or another
 * installed extension. Chrome sets `Origin` on an extension's cross-origin
 * fetch and a page cannot forge it, so the origin is trustworthy here. The
 * bridge remembers the first extension that connects and accepts only that one
 * afterwards, which needs no configuration at all.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PIN_FILE = '.arlo-client';
const EXTENSION = 'chrome-extension://';

export interface ClientDecision {
  allowed: boolean;
  /** Set when this origin should become the remembered client. */
  pin?: string;
  reason?: 'no-origin' | 'not-a-client' | 'another-client';
}

export function decideClient(
  origin: string | undefined,
  pinned: string | null,
  extras: readonly string[],
): ClientDecision {
  // A browser always sends Origin cross-origin. Anything without one is not the
  // panel, and letting it through is how a local script would get in.
  if (!origin) return { allowed: false, reason: 'no-origin' };
  if (extras.includes(origin)) return { allowed: true };
  if (!origin.startsWith(EXTENSION)) return { allowed: false, reason: 'not-a-client' };
  if (!pinned) return { allowed: true, pin: origin };
  if (pinned === origin) return { allowed: true };
  return { allowed: false, reason: 'another-client' };
}

export async function readPinnedClient(root: string): Promise<string | null> {
  try {
    const raw = await readFile(join(root, PIN_FILE), 'utf8');
    return raw.trim() || null;
  } catch {
    return null;
  }
}

export async function writePinnedClient(root: string, origin: string): Promise<void> {
  await writeFile(join(root, PIN_FILE), `${origin}\n`, 'utf8');
}
