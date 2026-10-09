/**
 * Voice input for the composer: the microphone in, text out. The panel never
 * acts on speech by itself — it produces the same text a person would type.
 *
 * Audio is streamed to a transcription socket, so words appear in the composer
 * while you are still talking — the OpenAI Realtime transcription socket, or
 * Gemini's Live API with input transcription turned on. A clip-then-transcribe
 * mode was dropped: it showed nothing until you stopped, and was slower to use.
 */
import { profileGeminiLiveUrl, profileRealtimeUrl, type LlmProfile } from '../shared/settings';

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
/** How long Gemini Live gets to accept the setup message. */
const LIVE_SETUP_MS = 8000;

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

/** What the Gemini Live API takes in. */
const GEMINI_SAMPLE_RATE = 16000;

interface PcmCapture {
  close: () => void;
}

/**
 * Microphone to 16-bit PCM chunks at `sampleRate`, through the packaged
 * worklet. The worklet is routed through a silent gain into the destination:
 * Chrome only runs graph nodes that lead to an output, and its own output is
 * silence, so nothing is played back.
 */
async function capturePcm(
  stream: MediaStream,
  sampleRate: number,
  onChunk: (pcm: ArrayBuffer) => void,
): Promise<PcmCapture> {
  const context = new AudioContext({ sampleRate });
  try {
    await context.audioWorklet.addModule(chrome.runtime.getURL('pcm-worklet.js'));
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, 'pcm-capture');
    node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => onChunk(event.data);
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(context.destination);
  } catch (cause) {
    void context.close().catch(() => undefined);
    throw new Error(cause instanceof Error ? cause.message : 'Could not capture audio.', {
      cause,
    });
  }
  return { close: () => void context.close().catch(() => undefined) };
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
  let capture: PcmCapture | null = null;
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
    capture?.close();
    capture = null;
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
    capture = await capturePcm(stream, 24000, (pcm) => {
      if (ws.readyState !== WebSocket.OPEN || stopping) return;
      ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(pcm) }));
    });
  } catch (cause) {
    teardown();
    throw cause;
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

/**
 * Gemini Live API with input transcription on. The key rides in the URL, which
 * is how Google's own browser examples authenticate this socket.
 *
 * Two kinds of model answer differently:
 * - Dedicated transcription models (`…-transcribe-live`) reply with text only.
 *   `interimInputTranscription` is a draft that is replaced as you speak, and
 *   `inputTranscription` is a finished segment.
 * - Conversational Live models must reply with audio, which is ignored; their
 *   `inputTranscription` arrives in fragments that are appended.
 */
async function startGeminiLive(
  profile: LlmProfile,
  handlers: DictationHandlers,
): Promise<Dictation> {
  const stream = await openMicrophone();
  const model = profile.voiceModel.trim().replace(/^models\//, '');
  let capture: PcmCapture | null = null;
  let finished = false;
  let stopping = false;
  let ready = false;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const transcribeOnly = /transcribe/i.test(model);
  // Finished text, plus the draft of the segment still being spoken.
  let spoken = '';
  let interim = '';
  const transcript = () =>
    [spoken, interim]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');

  const teardown = () => {
    clearTimeout(settle);
    release(stream);
    capture?.close();
    capture = null;
    if (ws.readyState <= WebSocket.OPEN) ws.close();
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

  const url = new URL(profileGeminiLiveUrl(profile));
  if (profile.apiKey) url.searchParams.set('key', profile.apiKey);
  const ws = new WebSocket(url);

  const opened = new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error('Could not open the Gemini Live connection.'));
  });
  try {
    await opened;
  } catch (cause) {
    release(stream);
    throw cause;
  }

  const setupDone = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      finished = true;
      teardown();
      reject(new Error('Gemini Live did not respond. Check the model name and API key.'));
    }, LIVE_SETUP_MS);
    ws.onmessage = async (event) => {
      let message: Record<string, unknown>;
      try {
        const raw = event.data instanceof Blob ? await event.data.text() : String(event.data);
        message = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      if ('setupComplete' in message) {
        ready = true;
        clearTimeout(timeout);
        resolve();
        return;
      }
      const content = message.serverContent as
        | {
            inputTranscription?: { text?: unknown };
            interimInputTranscription?: { text?: unknown };
            turnComplete?: unknown;
          }
        | undefined;
      const interimText = content?.interimInputTranscription?.text;
      if (typeof interimText === 'string') {
        interim = interimText;
        handlers.onText(transcript());
      }
      const finalText = content?.inputTranscription?.text;
      if (typeof finalText === 'string') {
        if (transcribeOnly) {
          spoken = [spoken, finalText].filter((part) => part.trim()).join(' ');
          interim = '';
        } else {
          spoken += finalText;
        }
        handlers.onText(transcript());
        // The segment that was still open when the mic closed is the last one.
        if (stopping && transcribeOnly) finish();
      }
      if (content?.turnComplete && stopping) finish();
    };
    ws.onclose = (event) => {
      clearTimeout(timeout);
      if (finished) return;
      if (!ready) {
        // Still starting: report through the start call rather than the handlers.
        finished = true;
        teardown();
        reject(
          new Error(
            event.reason
              ? `Gemini Live refused the connection: ${event.reason}`
              : 'Gemini Live closed the connection.',
          ),
        );
      } else if (stopping) finish();
      else fail('The Gemini Live connection closed.');
    };
  });

  ws.send(
    JSON.stringify({
      setup: {
        model: `models/${model}`,
        generationConfig: { responseModalities: [transcribeOnly ? 'TEXT' : 'AUDIO'] },
        // An empty list lets the model detect the language.
        inputAudioTranscription: transcribeOnly ? { languageCodes: [] } : {},
      },
    }),
  );
  await setupDone;

  try {
    capture = await capturePcm(stream, GEMINI_SAMPLE_RATE, (pcm) => {
      if (ws.readyState !== WebSocket.OPEN || stopping) return;
      ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: { data: toBase64(pcm), mimeType: `audio/pcm;rate=${GEMINI_SAMPLE_RATE}` },
          },
        }),
      );
    });
  } catch (cause) {
    finished = true;
    teardown();
    throw cause;
  }

  return {
    stop: () => {
      if (finished || stopping) return;
      stopping = true;
      handlers.onProcessing();
      release(stream);
      // Flushes audio the server is still holding, so the last words are transcribed.
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      }
      settle = setTimeout(finish, LIVE_SETTLE_MS);
    },
    cancel: () => {
      finished = true;
      teardown();
    },
  };
}

type Convert = (text: string) => string;
let converter: Promise<Convert> | null = null;

const HAN = /\p{Script=Han}/u;

/**
 * Chinese speech comes back in whichever script the model prefers, often
 * Simplified, so a Simplified transcript is converted to Traditional with
 * Taiwan wording (软件 becomes 軟體).
 *
 * Text that is already Traditional must stay exactly as spoken, and the phrase
 * conversion would still reword it (打開 to 開啟), as would a character-only one
 * (公里 to 公裡). So the script is judged first: a character that either
 * direction would change is "evidence" for that script, and several characters
 * are shared by both (里, 后, 发), which is why both directions are counted and
 * Simplified has to win. Other languages have no Han text and pass through.
 *
 * The dictionaries are large, so they are separate chunks fetched on the first
 * dictation only. If they cannot load, text is left as the model wrote it.
 */
export function loadTraditionalConverter(): Promise<Convert> {
  converter ??= Promise.all([import('opencc-js/cn2t'), import('opencc-js/t2cn')])
    .then(([forward, backward]) => {
      const phrases = forward.Converter({ from: 'cn', to: 'twp' });
      const traditionalOf = forward.Converter({ from: 'cn', to: 'tw' });
      const simplifiedOf = backward.Converter({ from: 'tw', to: 'cn' });
      const changed = (text: string, convert: (text: string) => string) =>
        [...text].filter((char) => HAN.test(char) && convert(char) !== char).length;
      return (text: string) =>
        HAN.test(text) && changed(text, traditionalOf) > changed(text, simplifiedOf)
          ? phrases(text)
          : text;
    })
    .catch(() => {
      converter = null;
      return (text: string) => text;
    });
  return converter;
}

export async function startDictation(
  profile: LlmProfile,
  handlers: DictationHandlers,
): Promise<Dictation> {
  const convert = await loadTraditionalConverter();
  const traditional: DictationHandlers = {
    ...handlers,
    onText: (text) => handlers.onText(convert(text)),
    onDone: (text) => handlers.onDone(convert(text)),
  };
  return profile.apiContract === 'gemini'
    ? startGeminiLive(profile, traditional)
    : startLive(profile, traditional);
}
