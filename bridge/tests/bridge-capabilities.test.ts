// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let child: ChildProcess;
let root: string;
let url: string;
const headers = { origin: 'http://arlo-test.invalid', 'content-type': 'application/json' };

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'arlo-capabilities-'));
  child = spawn(process.execPath, ['src/server.ts'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: {
      ...process.env,
      ARLO_BRIDGE_PORT: '0',
      ARLO_WORKSPACE_ROOT: root,
      ARLO_BRIDGE_TOKEN: '',
      ARLO_ALLOWED_ORIGINS: headers.origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  url = await new Promise<string>((resolve, reject) => {
    let output = '';
    child.stdout!.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = /Arlo bridge on (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
      if (match) resolve(match[1]!);
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Test bridge exited: ${code}`)));
  });
});

afterAll(async () => {
  if (child && child.exitCode === null) {
    const closed = once(child, 'exit');
    child.kill();
    await closed;
  }
  if (root) await rm(root, { recursive: true, force: true });
});

describe('bridge and panel compatibility', () => {
  it('advertises the installed reader in health and authenticated connection checks', async () => {
    for (const path of ['/health', '/verify']) {
      const response = await fetch(new URL(path, url), { headers });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, capabilities: { pageReader: 1 } });
    }
  });

  it('refuses an old panel before starting an agent that could read the wrong browser', async () => {
    const session = (await fetch(new URL('/sessions', url), { method: 'POST', headers }).then((r) =>
      r.json(),
    )) as { id: string };
    const response = await fetch(new URL(`/sessions/${session.id}/messages`, url), {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: 'Read this page and summarize its headlines', profile: {} }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringMatching(/Reload the extension/),
    });
  });
});
