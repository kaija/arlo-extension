/**
 * Who may drive the bridge.
 *
 * A token was the wrong gate: it defended against other local processes, which
 * is a position already lost — anything running code here can invoke `codex`
 * directly — while costing a copy-paste on every restart.
 *
 * The threat worth blocking is another *browser* client: a web page, or another
 * installed extension. Identifying one is fiddlier than it looks. An extension
 * holding a host permission for the target makes a privileged fetch: Chrome
 * bypasses CORS and may send no `Origin` header at all. So the panel also sends
 * its id in `X-Arlo-Client`, and either signal can establish who is calling.
 *
 * A web page cannot reach the second route: a custom header on a cross-origin
 * fetch forces a preflight, and a page always carries an `Origin` we refuse.
 * A local process can forge the header — see above for why that is acceptable.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PIN_FILE = '.arlo-client';
const EXTENSION = 'chrome-extension://';

export interface ClientRequest {
  origin: string | undefined;
  clientId: string | undefined;
}

export interface ClientDecision {
  allowed: boolean;
  /** Set when this client should become the remembered one. */
  pin?: string;
  reason?: 'unidentified' | 'not-a-client' | 'another-client';
}

/** Normalise either signal to the same `chrome-extension://<id>` form. */
function identify({ origin, clientId }: ClientRequest): string | null {
  if (origin?.startsWith(EXTENSION)) return origin;
  if (clientId && /^[a-z]{32}$/.test(clientId)) return `${EXTENSION}${clientId}`;
  return null;
}

export function decideClient(
  request: ClientRequest,
  pinned: string | null,
  extras: readonly string[],
): ClientDecision {
  // An explicitly configured origin (a dev page) is allowed but never pinned.
  if (request.origin && extras.includes(request.origin)) return { allowed: true };

  // A page always sends Origin, so a non-extension Origin is never our panel —
  // whatever else it claims about itself.
  if (request.origin && !request.origin.startsWith(EXTENSION)) {
    return { allowed: false, reason: 'not-a-client' };
  }

  const client = identify(request);
  if (!client) return { allowed: false, reason: 'unidentified' };
  if (!pinned) return { allowed: true, pin: client };
  if (pinned === client) return { allowed: true };
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

export async function writePinnedClient(root: string, client: string): Promise<void> {
  await writeFile(join(root, PIN_FILE), `${client}\n`, 'utf8');
}
