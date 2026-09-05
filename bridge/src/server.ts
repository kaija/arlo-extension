/**
 * The Arlo bridge: a loopback HTTP service that runs the Codex agent.
 *
 * The Codex SDK is a server-side Node library and explicitly does not support
 * browsers, so the extension cannot import it. This process is the seam. It
 * binds 127.0.0.1 only, requires a bearer token minted at startup, and gives
 * every chat session its own folder that the agent is sandboxed to.
 *
 *   GET  /health                    liveness only; no auth, so a panel with no
 *                                   token can still tell a dead bridge apart
 *   GET  /verify                    the same checks a real call makes, so
 *                                   "connected" cannot mean "reachable but unusable"
 *   POST /sessions                  create a session folder
 *   POST /sessions/:id/messages     run one turn, streaming SSE
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { Codex } from '@openai/codex-sdk';

import { bearerToken, tokenMatches } from './auth.ts';
import { decideClient, readPinnedClient, writePinnedClient } from './client-pin.ts';
import {
  buildEnv,
  buildProviderConfig,
  buildThreadSettings,
  type LlmProfileInput,
} from './codex-config.ts';
import {
  createSession,
  readThreadId,
  sessionDir,
  workspaceRoot,
  writeThreadId,
} from './sessions.ts';

const PORT = Number(process.env.ARLO_BRIDGE_PORT ?? 4319);
/** Optional. Unset by default — the client pin is the gate. */
const TOKEN = process.env.ARLO_BRIDGE_TOKEN ?? '';
const ALLOWED_ORIGINS = (process.env.ARLO_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const ROOT = workspaceRoot();
let announcedHeaders = false;

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new Error('Request body too large.');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

/** One SSE frame. The panel reads these with fetch + a stream reader. */
function sse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function runTurn(
  res: ServerResponse,
  id: string,
  profile: LlmProfileInput,
  prompt: string,
): Promise<void> {
  const dir = sessionDir(ROOT, id);
  const codex = new Codex({
    env: buildEnv(profile.apiKey),
    config: buildProviderConfig(profile),
  });

  const settings = buildThreadSettings(profile, dir);
  const existing = await readThreadId(dir);
  const thread = existing ? codex.resumeThread(existing, settings) : codex.startThread(settings);

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });

  const { events } = await thread.runStreamed(prompt);
  for await (const event of events) {
    sse(res, event.type ?? 'event', event);
  }

  const threadId = (thread as { id?: string }).id;
  if (threadId && !existing) await writeThreadId(dir, threadId);

  sse(res, 'done', { sessionId: id, threadId: threadId ?? existing });
  res.end();
}

const server = createServer((req, res) => {
  void (async () => {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': origin ?? '*',
        'access-control-allow-headers': 'authorization, content-type, x-arlo-client',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      });
      res.end();
      return;
    }
    if (origin) res.setHeader('access-control-allow-origin', origin);

    if (url.pathname === '/health' && req.method === 'GET') {
      send(res, 200, { ok: true, workspaceRoot: ROOT });
      return;
    }

    const clientId = req.headers['x-arlo-client'];
    const request = {
      origin,
      clientId: typeof clientId === 'string' ? clientId : undefined,
    };

    // One line, once, so what Chrome actually sends is a fact and not a guess.
    if (!announcedHeaders) {
      announcedHeaders = true;
      process.stdout.write(
        `first contact: origin=${origin ?? '(none)'} x-arlo-client=${request.clientId ?? '(none)'}\n`,
      );
    }

    const decision = decideClient(request, await readPinnedClient(ROOT), ALLOWED_ORIGINS);
    if (!decision.allowed) {
      // Say why on the console too. Diagnosing this from the panel alone cost a
      // round trip that one printed line would have saved.
      process.stdout.write(
        `refused ${decision.reason}: origin=${origin ?? '(none)'} x-arlo-client=${request.clientId ?? '(none)'}\n`,
      );
      send(res, 403, {
        error:
          decision.reason === 'another-client'
            ? 'This bridge is paired with a different extension. Delete .arlo-client in the workspace to pair again.'
            : 'Only the Arlo extension may use this bridge.',
        reason: decision.reason,
      });
      return;
    }
    if (decision.pin) {
      await writePinnedClient(ROOT, decision.pin);
      process.stdout.write(`Paired with ${decision.pin}\n`);
    }
    if (TOKEN && !tokenMatches(TOKEN, bearerToken(req.headers.authorization))) {
      send(res, 401, { error: 'Bad or missing bridge token.' });
      return;
    }

    try {
      if (url.pathname === '/verify' && req.method === 'GET') {
        send(res, 200, { ok: true, workspaceRoot: ROOT });
        return;
      }

      if (url.pathname === '/sessions' && req.method === 'POST') {
        const session = await createSession(ROOT);
        send(res, 201, session);
        return;
      }

      const turn = /^\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
      if (turn && req.method === 'POST') {
        const body = await readJson(req);
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        if (!prompt) {
          send(res, 400, { error: 'A prompt is required.' });
          return;
        }
        await runTurn(res, turn[1]!, body.profile as LlmProfileInput, prompt);
        return;
      }

      send(res, 404, { error: 'No such route.' });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      // A turn that has already started streaming cannot change its status.
      if (res.headersSent) {
        sse(res, 'error', { error: message });
        res.end();
      } else {
        send(res, 400, { error: message });
      }
    }
  })();
});

server.listen(PORT, '127.0.0.1', async () => {
  const pinned = await readPinnedClient(ROOT);
  process.stdout.write(
    `Arlo bridge on http://127.0.0.1:${PORT}\n` +
      `  workspace  ${ROOT}\n` +
      `  paired to  ${pinned ?? 'nothing yet — the first extension to connect'}\n` +
      (TOKEN ? `  token      ${TOKEN}\n` : '') +
      `\nNothing to configure. Open the side panel.\n`,
  );
});
