/**
 * Voice input for the composer: the microphone in, text out. The panel never
 * acts on speech by itself — it produces the same text a person would type.
 *
 * Two ways to get there, picked by the profile's voice mode:
 * - `stt` records a clip and posts it to `/audio/transcriptions` on stop.
 * - `live` streams PCM to the Realtime transcription socket, so words appear
 *   in the composer while you are still talking.
 */
import {
  profileRealtimeUrl,
  profileTranscriptionsEndpoint,
  type LlmProfile,
} from '../shared/settings';

export interface DictationHandlers {
  /** Text so far for this dictation (replaces any earlier partial). */
  onText: (text: string) => void;
  /** The microphone is closed and a transcript is being fetched. */
  onProcessing: () => void;
  /** Nothing more will arrive; `text` is the final transcript. */
  onDone: (text: string) => void;
  onError: (message: string) => void;
}

export interface Dictation {
  /** Stop listening and let the transcript finish. */
  stop: () => void;
  /** Stop and throw everything away. */
  cancel: () => void;
}

/** How long a live session waits for its last transcript after the mic closes. */
const LIVE_SETTLE_MS = 4000;

export const MIC_BLOCKED_MESSAGE =
  'Chrome has not allowed Arlo to use the microphone. Open Arlo settings and choose "Allow microphone" under Voice input.';

export async function openMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot record audio.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (cause) {
    const name = cause instanceof DOMException ? cause.name : '';
    if (name === 'NotFoundError') throw new Error('No microphone was found.', { cause });
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error(MIC_BLOCKED_MESSAGE, { cause });
    }
    throw new Error(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

function release(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

function authHeaders(profile: LlmProfile): Record<string, string> {
  return profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {};
}

/** Pick a container the browser can write and transcription endpoints accept. */
function recorderType(): { mimeType?: string; extension: string } {
  for (const [mimeType, extension] of [
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/webm', 'webm'],
    ['audio/mp4', 'mp4'],
  ] as const) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return { mimeType, extension };
    }
  }
  return { extension: 'webm' };
}

export async function transcribeClip(
  profile: LlmProfile,
  clip: Blob,
  extension: string,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.append('file', clip, `speech.${extension}`);
  form.append('model', profile.voiceModel.trim());
  form.append('response_format', 'json');
  let response: Response;
  try {
    response = await fetch(profileTranscriptionsEndpoint(profile), {
      method: 'POST',
      headers: authHeaders(profile),
      body: form,
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new Error('Could not reach the speech-to-text endpoint. Check the network connection.', {
      cause,
    });
  }
  const raw = await response.text();
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // Not JSON; the status line below is the best we have.
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!response.ok) {
    const error = record.error;
    const detail =
      error &&
      typeof error === 'object' &&
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : `HTTP ${response.status}`;
    throw new Error(`Speech-to-text failed: ${detail}`);
  }
  return typeof record.text === 'string' ? record.text.trim() : '';
}

/** Record, then transcribe once on stop. */
async function startRecorded(profile: LlmProfile, handlers: DictationHandlers): Promise<Dictation> {
  const stream = await openMicrophone();
  const { mimeType, extension } = recorderType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const abort = new AbortController();
  let discarded = false;

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => {
    release(stream);
    if (!discarded) handlers.onError('Recording failed.');
  };
  recorder.onstop = () => {
    release(stream);
    if (discarded) return;
    if (chunks.length === 0) {
      handlers.onDone('');
      return;
    }
    handlers.onProcessing();
    const clip = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
    transcribeClip(profile, clip, extension, abort.signal)
      .then((text) => !discarded && handlers.onDone(text))
      .catch((cause: unknown) => {
        if (discarded) return;
        handlers.onError(cause instanceof Error ? cause.message : String(cause));
      });
  };
  recorder.start();

  return {
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
    },
    cancel: () => {
      discarded = true;
      abort.abort();
      if (recorder.state !== 'inactive') recorder.stop();
      release(stream);
    },
  };
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Stream to the Realtime transcription socket.
 *
 * Browsers cannot set an Authorization header on a WebSocket, so the key rides
 * in a subprotocol — the documented browser route, and why it is the user's own
 * key going to the origin they configured, nowhere else.
 */
async function startLive(profile: LlmProfile, handlers: DictationHandlers): Promise<Dictation> {
  const stream = await openMicrophone();
  const model = profile.voiceModel.trim();
  let context: AudioContext | null = null;
  let socket: WebSocket | null = null;
  let finished = false;
  let stopping = false;
  let settle: ReturnType<typeof setTimeout> | undefined;
  // Finished turns, plus the one still being spoken.
  const turns: string[] = [];
  const partials = new Map<string, string>();
  const order: string[] = [];

  const transcript = () =>
    [...turns, ...order.map((id) => partials.get(id) ?? '')]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');

  const teardown = () => {
    clearTimeout(settle);
    release(stream);
    void context?.close().catch(() => undefined);
    context = null;
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    socket = null;
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    const text = transcript();
    teardown();
    handlers.onDone(text);
  };

  const fail = (message: string) => {
    if (finished) return;
    finished = true;
    teardown();
    handlers.onError(message);
  };

  const url = profileRealtimeUrl(profile);
  const protocols = ['realtime'];
  if (profile.apiKey) protocols.push(`openai-insecure-api-key.${profile.apiKey}`);
  const ws = new WebSocket(url, protocols);
  socket = ws;

  const opened = new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error('Could not open the live transcription connection.'));
  });

  try {
    await opened;
  } catch (cause) {
    teardown();
    throw cause;
  }

  // The newer "live" transcription models turn-detect on the client, so the
  // server is told not to; every other model keeps server-side detection.
  const serverVad = !/live/i.test(model);
  ws.send(
    JSON.stringify({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model },
            turn_detection: serverVad ? { type: 'server_vad' } : null,
          },
        },
      },
    }),
  );

  ws.onmessage = (event) => {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(event.data)) as Record<string, unknown>;
    } catch {
      return;
    }
    const id = typeof message.item_id === 'string' ? message.item_id : 'turn';
    switch (message.type) {
      case 'conversation.item.input_audio_transcription.delta':
        if (typeof message.delta === 'string') {
          if (!partials.has(id)) order.push(id);
          partials.set(id, (partials.get(id) ?? '') + message.delta);
          handlers.onText(transcript());
        }
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (typeof message.transcript === 'string') {
          if (!partials.has(id)) order.push(id);
          partials.set(id, message.transcript);
          handlers.onText(transcript());
          if (stopping) finish();
        }
        break;
      case 'error': {
        // Committing after server-side detection already did is harmless.
        if (stopping) {
          finish();
          break;
        }
        const detail = message.error as { message?: unknown } | undefined;
        fail(
          typeof detail?.message === 'string'
            ? `Live transcription failed: ${detail.message}`
            : 'Live transcription failed.',
        );
        break;
      }
    }
  };
  ws.onclose = () => {
    if (!finished) {
      if (stopping) finish();
      else fail('The live transcription connection closed.');
    }
  };

  try {
    context = new AudioContext({ sampleRate: 24000 });
    await context.audioWorklet.addModule(chrome.runtime.getURL('pcm-worklet.js'));
    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, 'pcm-capture');
    capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState !== WebSocket.OPEN || stopping) return;
      ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(event.data) }));
    };
    source.connect(capture);
  } catch (cause) {
    teardown();
    throw new Error(cause instanceof Error ? cause.message : 'Could not capture audio.', {
      cause,
    });
  }

  return {
    stop: () => {
      if (finished || stopping) return;
      stopping = true;
      handlers.onProcessing();
      release(stream);
      // Closes the open turn; the server may reject it if it already did.
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      }
      settle = setTimeout(finish, LIVE_SETTLE_MS);
    },
    cancel: () => {
      finished = true;
      teardown();
    },
  };
}

export function startDictation(
  profile: LlmProfile,
  handlers: DictationHandlers,
): Promise<Dictation> {
  return profile.voiceMode === 'live'
    ? startLive(profile, handlers)
    : startRecorded(profile, handlers);
}
