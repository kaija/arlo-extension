/**
 * Thought-signature round-tripping for Gemini's OpenAI-compatible endpoint.
 *
 * Gemini 3 attaches an opaque `extra_content.google.thought_signature` to a
 * tool call and rejects the next request with HTTP 400 if the assistant
 * message that replays the call does not carry it back. The Agents SDK keeps
 * such extra fields when it reads a whole response, but its streaming reader
 * drops them, and the panel streams. So this wrapper sits under the OpenAI
 * client's `fetch`: it copies signatures out of responses, keyed by tool call
 * id, and writes them onto the matching tool calls of later requests. The SDK
 * itself sees both sides unchanged.
 */

/** Documented placeholder that tells Gemini to skip validation for a call. */
const SKIP_VALIDATION = 'skip_thought_signature_validator';
const MAX_REMEMBERED = 500;

/** Lives for the panel's lifetime, like the conversation history it serves. */
const signatures = new Map<string, string>();
/** The previous response's scan; the next request waits for it so no signature is missed. */
let scanning: Promise<void> = Promise.resolve();

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function signatureOf(toolCall: UnknownRecord): string | null {
  const google = asRecord(asRecord(toolCall.extra_content)?.google);
  return typeof google?.thought_signature === 'string' ? google.thought_signature : null;
}

function remember(id: string, signature: string) {
  signatures.delete(id);
  signatures.set(id, signature);
  if (signatures.size > MAX_REMEMBERED) {
    const oldest = signatures.keys().next().value;
    if (oldest !== undefined) signatures.delete(oldest);
  }
}

/** Record every signature in one parsed response or stream chunk. */
function collect(payload: unknown, idsByIndex: Map<number, string>) {
  const choices = asRecord(payload)?.choices;
  if (!Array.isArray(choices)) return;
  for (const choice of choices) {
    const record = asRecord(choice);
    const body = asRecord(record?.delta) ?? asRecord(record?.message);
    const toolCalls = body?.tool_calls;
    if (!Array.isArray(toolCalls)) continue;
    for (const raw of toolCalls) {
      const call = asRecord(raw);
      if (!call) continue;
      const index = typeof call.index === 'number' ? call.index : null;
      if (typeof call.id === 'string' && call.id && index !== null) idsByIndex.set(index, call.id);
      const id =
        typeof call.id === 'string' && call.id
          ? call.id
          : index !== null
            ? idsByIndex.get(index)
            : undefined;
      const signature = signatureOf(call);
      if (id && signature) remember(id, signature);
    }
  }
}

async function sniffStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const idsByIndex = new Map<number, string>();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';
    for (const event of events) {
      for (const line of event.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          collect(JSON.parse(data), idsByIndex);
        } catch {
          // A partial or non-JSON line is not worth failing the turn over.
        }
      }
    }
  }
}

async function sniffResponse(response: Response) {
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('text/event-stream') && response.body) {
    await sniffStream(response.body);
  } else if (type.includes('json')) {
    collect(await response.json(), new Map());
  }
}

/** Put remembered signatures back on assistant tool calls in an outgoing body. */
function restore(body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  const messages = asRecord(parsed)?.messages;
  if (!Array.isArray(messages)) return body;
  let changed = false;
  for (const message of messages) {
    const toolCalls = asRecord(message)?.tool_calls;
    if (!Array.isArray(toolCalls)) continue;
    for (const raw of toolCalls) {
      const call = asRecord(raw);
      if (!call || signatureOf(call)) continue;
      const id = typeof call.id === 'string' ? call.id : '';
      const google = asRecord(asRecord(call.extra_content)?.google) ?? {};
      call.extra_content = {
        ...asRecord(call.extra_content),
        google: { ...google, thought_signature: signatures.get(id) ?? SKIP_VALIDATION },
      };
      changed = true;
    }
  }
  return changed ? JSON.stringify(parsed) : body;
}

export async function geminiFetch(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): Promise<Response> {
  await scanning;
  const next = init && typeof init.body === 'string' ? { ...init, body: restore(init.body) } : init;
  const response = await globalThis.fetch(input, next);
  if (response.ok) {
    // Read a copy in the background; the SDK gets the untouched original.
    scanning = sniffResponse(response.clone()).catch(() => undefined);
  }
  return response;
}

/** Test seam: signatures persist for the panel's lifetime otherwise. */
export function resetGeminiSignatures() {
  signatures.clear();
  scanning = Promise.resolve();
}
