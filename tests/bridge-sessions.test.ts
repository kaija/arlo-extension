// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createSession,
  isSessionId,
  readThreadId,
  sessionDir,
  writeThreadId,
} from '../bridge/src/sessions.ts';

let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'arlo-sessions-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('sessions', () => {
  it('gives every session its own folder under the workspace root', async () => {
    const a = await createSession(root);
    const b = await createSession(root);
    expect(a.id).not.toBe(b.id);
    expect(a.dir.startsWith(root)).toBe(true);
    expect(a.dir).not.toBe(b.dir);
  });

  it('refuses anything that is not a session id, so a path cannot escape', () => {
    expect(isSessionId(crypto.randomUUID())).toBe(true);
    for (const bad of ['..', '../../etc', 'a/b', '', 'not-a-uuid']) {
      expect(isSessionId(bad)).toBe(false);
      expect(() => sessionDir(root, bad)).toThrow();
    }
  });

  it('remembers the Codex thread so a restart resumes the same chat', async () => {
    const { dir } = await createSession(root);
    expect(await readThreadId(dir)).toBeNull();
    await writeThreadId(dir, 'thread_123');
    expect(await readThreadId(dir)).toBe('thread_123');
  });
});
