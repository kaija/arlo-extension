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
import { BRIDGE_CAPABILITIES, supportsPageReader } from '../../src/shared/bridge-protocol.ts';

import { bearerToken, tokenMatches } from './auth.ts';
import { decideClient, readPinnedClient, writePinnedClient } from './client-pin.ts';
import {
  PAGE_TOOL_TOKEN_ENV,
  PageToolChannel,
  pageToolConfig,
  servePageMcp,
} from './page-tools.ts';
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
const pageChannels = new Map<string, { sessionId: string; channel: PageToolChannel }>();
const runningSessions = new Set<string>();

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
  if (runningSessions.has(id)) throw new Error('This chat already has a running turn.');
  const channel = new PageToolChannel((request) => sse(res, 'page.read', request));
  const abort = new AbortController();
  const onClose = () => {
    channel.close();
    abort.abort();
  };
  runningSessions.add(id);
  pageChannels.set(channel.id, { sessionId: id, channel });
  res.once('close', onClose);
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('The bridge is not listening.');
    const codex = new Codex({
      env: { ...buildEnv(profile.apiKey), [PAGE_TOOL_TOKEN_ENV]: channel.token },
      config: {
        ...buildProviderConfig(profile),
        ...pageToolConfig(`http://127.0.0.1:${address.port}`, channel),
      },
    });

    const settings = buildThreadSettings(profile, dir);
    const existing = await readThreadId(dir);
    const thread = existing ? codex.resumeThread(existing, settings) : codex.startThread(settings);

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    // Send the stream headers before Codex produces its first line so the
    // browser can begin consuming each later update without header buffering.
    res.flushHeaders();

    const { events } = await thread.runStreamed(prompt, { signal: abort.signal });
    for await (const event of events) {
      sse(res, event.type ?? 'event', event);
    }

    const threadId = (thread as { id?: string }).id;
    if (threadId && !existing) await writeThreadId(dir, threadId);

    sse(res, 'done', { sessionId: id, threadId: threadId ?? existing });
    res.end();
  } finally {
    channel.close();
    pageChannels.delete(channel.id);
    runningSessions.delete(id);
    res.removeListener('close', onClose);
  }
}

const server = createServer((req, res) => {
  void (async () => {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

    // Codex has a separate, per-turn capability. Never let it use the extension
    // pairing routes, and never let a webpage reach MCP through a browser Origin.
    const mcp = /^\/mcp\/([^/]+)$/.exec(url.pathname);
    if (mcp) {
      const entry = pageChannels.get(mcp[1]!);
      if (origin || !entry?.channel.accepts(bearerToken(req.headers.authorization))) {
        send(res, 403, { error: 'This page tool is not available to this caller.' });
        return;
      }
      if (req.method !== 'POST') {
        res.setHeader('allow', 'POST');
        send(res, 405, { error: 'Use POST for this stateless MCP endpoint.' });
        return;
      }
      try {
        await servePageMcp(req, res, await readJson(req), entry.channel);
      } catch (cause) {
        if (!res.headersSent)
          send(res, 400, { error: cause instanceof Error ? cause.message : String(cause) });
        else res.end();
      }
      return;
    }

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
      send(res, 200, { ok: true, workspaceRoot: ROOT, capabilities: BRIDGE_CAPABILITIES });
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
        send(res, 200, { ok: true, workspaceRoot: ROOT, capabilities: BRIDGE_CAPABILITIES });
        return;
      }

      if (url.pathname === '/sessions' && req.method === 'POST') {
        const session = await createSession(ROOT);
        send(res, 201, session);
        return;
      }

      const pageResult = /^\/sessions\/([^/]+)\/page-results\/([^/]+)$/.exec(url.pathname);
      if (pageResult && req.method === 'POST') {
        const body = await readJson(req);
        const entry = [...pageChannels.values()].find((item) => item.sessionId === pageResult[1]);
        if (!entry?.channel.complete(pageResult[2]!, body)) {
          send(res, 410, { error: 'This page read is no longer pending.' });
          return;
        }
        send(res, 200, { ok: true });
        return;
      }

      const turn = /^\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
      if (turn && req.method === 'POST') {
        const body = await readJson(req);
        if (!supportsPageReader(body)) {
          send(res, 409, {
            error:
              'This Arlo panel needs to be reloaded to read the current page. Reload the extension at chrome://extensions, then reopen the panel.',
          });
          return;
        }
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
  const address = server.address();
  const listeningPort = address && typeof address !== 'string' ? address.port : PORT;
  process.stdout.write(
    `Arlo bridge on http://127.0.0.1:${listeningPort}\n` +
      `  workspace  ${ROOT}\n` +
      `  paired to  ${pinned ?? 'nothing yet — the first extension to connect'}\n` +
      (TOKEN ? `  token      ${TOKEN}\n` : '') +
      `\nNothing to configure. Open the side panel.\n`,
  );
});
