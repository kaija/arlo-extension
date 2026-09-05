/**
 * Talks to the local Codex bridge.
 *
 * The stream is owned by the panel rather than the service worker: an MV3
 * worker is torn down after roughly thirty seconds idle and an agent turn runs
 * for minutes. The cost is that closing the panel ends the turn.
 */

export interface BridgeConfig {
  url: string;
  token: string;
}

export interface SseFrame {
  event: string;
  data: unknown;
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
export function agentMessageText(frame: SseFrame): string | null {
  if (frame.event !== 'item.completed') return null;
  const item = (frame.data as { item?: { type?: string; text?: string } })?.item;
  return item?.type === 'agent_message' && typeof item.text === 'string' ? item.text : null;
}

export function turnError(frame: SseFrame): string | null {
  const data = frame.data as { message?: string; error?: { message?: string } | string };
  if (frame.event === 'error') return data?.message ?? 'The agent reported an error.';
  if (frame.event === 'turn.failed') {
    const error = data?.error;
    return (typeof error === 'string' ? error : error?.message) ?? 'The turn failed.';
  }
  return null;
}

function headers(config: BridgeConfig): Record<string, string> {
  return { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' };
}

export async function bridgeOnline(config: BridgeConfig): Promise<boolean> {
  try {
    const response = await fetch(new URL('/health', config.url), { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
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
  onText: (text: string) => void;
  onError: (message: string) => void;
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
    body: JSON.stringify({ prompt, profile }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error('The bridge sent no response body.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = parseSseChunk(buffer);
    buffer = rest;
    for (const frame of frames) {
      const text = agentMessageText(frame);
      if (text) handlers.onText(text);
      const error = turnError(frame);
      if (error) handlers.onError(error);
    }
  }
}
