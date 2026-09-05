// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  createPageMcpServer,
  PageToolChannel,
  pageToolConfig,
  PAGE_TOOL_TOKEN_ENV,
  servePageMcp,
} from '../src/page-tools.ts';
import type { TabReadResult } from '../../src/shared/tab-read';

afterEach(() => vi.useRealTimers());

const failure: TabReadResult = {
  ok: false,
  error: { code: 'PAGE_ACCESS_REQUIRED', message: 'Grant access.' },
};

describe('turn-scoped page channel', () => {
  it('only resolves its own pending request, once', async () => {
    const emit = vi.fn();
    const channel = new PageToolChannel(emit);
    const other = new PageToolChannel(vi.fn());
    const pending = channel.read({ level: 'detailed' });
    const request = emit.mock.calls[0]![0];
    expect(request.options.level).toBe('detailed');
    expect(other.complete(request.requestId, failure)).toBe(false);
    expect(channel.accepts(other.token)).toBe(false);
    expect(channel.accepts(channel.token)).toBe(true);
    expect(channel.complete(request.requestId, failure)).toBe(true);
    expect(channel.complete(request.requestId, failure)).toBe(false);
    expect(await pending).toEqual(failure);
    channel.close();
    expect(channel.accepts(channel.token)).toBe(false);
  });

  it('times out, clears pending work on disconnect and rejects reads after close', async () => {
    vi.useFakeTimers();
    const channel = new PageToolChannel(vi.fn(), 100);
    const first = channel.read({});
    await vi.advanceTimersByTimeAsync(100);
    expect(await first).toMatchObject({ error: { code: 'READ_TIMEOUT' } });
    const next = channel.read({});
    channel.close();
    expect(await next).toMatchObject({ error: { code: 'PANEL_DISCONNECTED' } });
    expect(await channel.read({})).toMatchObject({ error: { code: 'PANEL_DISCONNECTED' } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('validates tool arguments before requesting browser content', async () => {
    const emit = vi.fn();
    const channel = new PageToolChannel(emit);
    expect(await channel.read({ level: 'wrong' })).toMatchObject({
      error: { code: 'INVALID_ARGUMENT' },
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('bounds concurrent reads and rejects malformed browser replies', async () => {
    const emit = vi.fn();
    const channel = new PageToolChannel(emit);
    const pending = Array.from({ length: 8 }, () => channel.read({}));
    expect(await channel.read({})).toMatchObject({ error: { code: 'BUSY' } });
    expect(() => channel.complete(emit.mock.calls[0]![0].requestId, { ok: true })).toThrow(
      /Invalid/,
    );
    channel.close();
    await Promise.all(pending);
  });

  it('registers only the read tool using a per-turn URL and an environment token', () => {
    const channel = new PageToolChannel(vi.fn());
    const config = pageToolConfig('http://127.0.0.1:4319', channel);
    expect(config).toMatchObject({
      mcp_servers: {
        arlo_page: {
          url: `http://127.0.0.1:4319/mcp/${channel.id}`,
          bearer_token_env_var: PAGE_TOOL_TOKEN_ENV,
          enabled_tools: ['read_current_tab'],
        },
      },
    });
    expect(JSON.stringify(config)).not.toContain(channel.token);
  });
});

describe('MCP registration and calls', () => {
  it('supports initialization, discovery and tool replies over real stateless HTTP', async () => {
    const channel = new PageToolChannel((request) => channel.complete(request.requestId, failure));
    const http = createServer((req, res) => {
      void servePageMcp(req, res, undefined, channel).catch((cause: unknown) => {
        res.writeHead(500);
        res.end(String(cause));
      });
    });
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const address = http.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    const client = new Client({ name: 'http-test', version: '1' });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)),
      );
      expect((await client.listTools()).tools[0]?.name).toBe('read_current_tab');
      expect(await client.callTool({ name: 'read_current_tab' })).toMatchObject({
        isError: true,
        content: [{ type: 'text', text: JSON.stringify(failure) }],
      });
    } finally {
      channel.close();
      await client.close();
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });

  it('discovers the tool and round-trips a page read through the actual MCP protocol', async () => {
    const channel = new PageToolChannel((request) => {
      channel.complete(request.requestId, {
        ok: true,
        page: {
          tabId: 42,
          url: 'https://example.com',
          title: 'Example',
          capturedAt: new Date().toISOString(),
          level: request.options.level,
          scope: 'main-frame',
          content: '# Example',
          totalChars: 9,
          offset: 0,
          nextOffset: null,
          snapshotId: 'a'.repeat(64),
        },
      });
    });
    const server = createPageMcpServer(channel);
    const client = new Client({ name: 'test-codex-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(['read_current_tab']);
      expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
      const reply = await client.callTool({
        name: 'read_current_tab',
        arguments: { level: 'html' },
      });
      expect(reply.isError).toBe(false);
      expect(reply.content).toEqual([
        { type: 'text', text: expect.stringContaining('"level":"html"') },
      ]);
      expect(
        (await client.callTool({ name: 'read_current_tab', arguments: { level: 'wrong' } }))
          .isError,
      ).toBe(true);
      expect((await client.callTool({ name: 'unknown' })).isError).toBe(true);
    } finally {
      channel.close();
      await client.close();
      await server.close();
    }
  });
});
