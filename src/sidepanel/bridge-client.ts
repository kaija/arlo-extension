/**
 * Talks to the local Codex bridge.
 *
 * The stream is owned by the panel rather than the service worker: an MV3
 * worker is torn down after roughly thirty seconds idle and an agent turn runs
 * for minutes. The cost is that closing the panel ends the turn.
 */
import { tabReadFailure, type TabReadRequest, type TabReadResult } from '../shared/tab-read';
import { BRIDGE_CAPABILITIES, supportsPageReader } from '../shared/bridge-protocol';

export interface BridgeConfig {
  url: string;
  token: string;
}

export interface SseFrame {
  event: string;
  data: unknown;
}

/** The latest complete snapshot of one assistant message in a streamed turn. */
export interface AgentMessageUpdate {
  id: string;
  text: string;
  /** The message will not receive any more snapshots. */
  completed: boolean;
}

/**
 * Split whatever has arrived so far into complete frames, returning the
 * remainder so the next chunk can be appended to it. A frame is only ever
 * emitted once its blank-line terminator has been seen.
 */
export function parseSseChunk(buffer: string): { frames: SseFrame[]; rest: string } {
  const frames: SseFrame[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';

  for (const part of parts) {
    let event = 'message';
    const data: string[] = [];
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length === 0) continue;
    const raw = data.join('\n');
    try {
      frames.push({ event, data: JSON.parse(raw) });
    } catch {
      frames.push({ event, data: raw });
    }
  }
  return { frames, rest };
}

/** The assistant's prose, as opposed to the agent's tool and file activity. */
export function agentMessageText(frame: SseFrame): AgentMessageUpdate | null {
  const isItemEvent =
    frame.event === 'item.started' ||
    frame.event === 'item.updated' ||
    frame.event === 'item.completed';
  if (!isItemEvent) return null;

  const item = (frame.data as { item?: { id?: string; type?: string; text?: string } })?.item;
  if (
    item?.type !== 'agent_message' ||
    typeof item.id !== 'string' ||
    typeof item.text !== 'string'
  )
    return null;

  return { id: item.id, text: item.text, completed: frame.event === 'item.completed' };
}

export function turnError(frame: SseFrame): string | null {
  const data = frame.data as { message?: string; error?: { message?: string } | string };
  if (frame.event === 'error')
    return (
      data?.message ??
      (typeof data?.error === 'string' ? data.error : data?.error?.message) ??
      'The agent reported an error.'
    );
  if (frame.event === 'turn.failed') {
    const error = data?.error;
    return (typeof error === 'string' ? error : error?.message) ?? 'The turn failed.';
  }
  return null;
}

/**
 * An extension holding a host permission makes a privileged fetch, and Chrome
 * may send no Origin with it — so the panel names itself explicitly. The token
 * is optional; pairing is the gate unless one was configured.
 */
function headers(config: BridgeConfig): Record<string, string> {
  const id = typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : '';
  return {
    'content-type': 'application/json',
    ...(id ? { 'x-arlo-client': id } : {}),
    ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
  };
}

/**
 * Why the bridge is unreachable, rather than just that it is. A blocked fetch
 * and a dead server look identical from inside `catch`, and telling someone to
 * start a process that is already running wastes their time.
 */
export type BridgeStatus =
  | 'checking'
  | 'ok'
  /** Nothing is listening. */
  | 'offline'
  /** Chrome blocked the request before it left the browser. */
  | 'forbidden'
  /** The bridge is up but will not accept our token. */
  | 'unauthorized'
  /** The bridge is up but is paired with a different extension. */
  | 'paired-elsewhere'
  /** The bridge is up but will not accept this caller. */
  | 'rejected'
  /** Reachable, but running code from before the current-page reader. */
  | 'upgrade-required'
  | 'unconfigured';

/**
 * The host pattern Chrome needs in order to let the panel reach the bridge.
 * Match patterns carry no port, so the configured one is dropped on purpose.
 */
export function bridgeOriginPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

export async function hasHostAccess(pattern: string): Promise<boolean> {
  // Outside an extension — tests, the preview harness — there is nothing to grant.
  if (typeof chrome === 'undefined' || !chrome.permissions) return true;
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

/** Must run inside a click: Chrome only grants optional permissions on a gesture. */
export async function requestHostAccess(pattern: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [pattern] });
}

/**
 * Probes the route a real call goes through, not just liveness. /health is open
 * on purpose — it answers even without a token — so checking only that reported
 * a healthy bridge while every actual request was being refused.
 */
export async function probeBridge(config: BridgeConfig): Promise<BridgeStatus> {
  const pattern = bridgeOriginPattern(config.url);
  if (!pattern) return 'unconfigured';
  if (!(await hasHostAccess(pattern))) return 'forbidden';

  let response: Response;
  try {
    response = await fetch(new URL('/verify', config.url), {
      method: 'GET',
      headers: headers(config),
    });
  } catch {
    return 'offline';
  }

  if (response.status === 401) return 'unauthorized';
  if (response.status === 403) {
    // The bridge says which kind of refusal it was; guessing produced a screen
    // that told people to unpair a bridge that had never paired with anything.
    const reason = await response
      .json()
      .then((body: { reason?: string }) => body.reason)
      .catch(() => undefined);
    return reason === 'another-client' ? 'paired-elsewhere' : 'rejected';
  }
  if (!response.ok) return 'offline';
  const info: unknown = await response.json().catch(() => null);
  return supportsPageReader(info) ? 'ok' : 'upgrade-required';
}

export async function createSession(config: BridgeConfig): Promise<string> {
  const response = await fetch(new URL('/sessions', config.url), {
    method: 'POST',
    headers: headers(config),
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { id: string };
  return body.id;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // fall through to the status line
  }
  if (response.status === 401) return 'The bridge rejected the token. Check it in settings.';
  return `The bridge returned ${response.status}.`;
}

export interface TurnHandlers {
  onText: (message: AgentMessageUpdate) => void;
  onError: (message: string) => void;
  onPageRead?: (options: unknown) => Promise<TabReadResult>;
}

export async function streamTurn(
  config: BridgeConfig,
  sessionId: string,
  prompt: string,
  profile: unknown,
  handlers: TurnHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(new URL(`/sessions/${sessionId}/messages`, config.url), {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({
      prompt,
      profile,
      capabilities: handlers.onPageRead ? BRIDGE_CAPABILITIES : {},
    }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error('The bridge sent no response body.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = parseSseChunk(buffer);
      buffer = rest;
      for (const frame of frames) {
        if (frame.event === 'page.read') {
          const request = frame.data as TabReadRequest;
          if (
            !request ||
            typeof request.requestId !== 'string' ||
            !/^[a-f0-9-]{36}$/.test(request.requestId)
          ) {
            throw new Error('The bridge sent an invalid page read request.');
          }
          let result: TabReadResult;
          try {
            result = handlers.onPageRead
              ? await handlers.onPageRead(request.options)
              : {
                  ok: false,
                  error: {
                    code: 'READER_UNAVAILABLE',
                    message: 'Reload the Arlo extension to enable page reading.',
                  },
                };
          } catch (cause) {
            result = tabReadFailure(cause);
          }
          const reply = await fetch(
            new URL(`/sessions/${sessionId}/page-results/${request.requestId}`, config.url),
            {
              method: 'POST',
              headers: headers(config),
              body: JSON.stringify(result),
              ...(signal ? { signal } : {}),
            },
          );
          // A timeout or ended turn can retire a read while Chrome is answering.
          if (!reply.ok && reply.status !== 410) throw new Error(await readError(reply));
          continue;
        }
        const text = agentMessageText(frame);
        if (text) handlers.onText(text);
        const error = turnError(frame);
        if (error) handlers.onError(error);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
