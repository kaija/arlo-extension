/**
 * A session is a folder. The agent gets one per chat and is confined to it, so
 * nothing it writes can reach another session or the rest of the disk.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function workspaceRoot(): string {
  const configured = process.env.ARLO_WORKSPACE_ROOT;
  return configured ? resolve(configured) : join(homedir(), '.arlo', 'sessions');
}

export function isSessionId(value: string): boolean {
  return SESSION_ID.test(value);
}

/**
 * Resolve a session folder, refusing anything that would escape the root. The
 * id format already rules out traversal; this is the belt to that's braces.
 */
export function sessionDir(root: string, id: string): string {
  if (!isSessionId(id)) throw new Error('Not a session id.');
  const dir = resolve(root, id);
  if (dir !== join(resolve(root), id))
    throw new Error('Session folder escapes the workspace root.');
  return dir;
}

export async function createSession(root: string): Promise<{ id: string; dir: string }> {
  const id = crypto.randomUUID();
  const dir = sessionDir(root, id);
  await mkdir(dir, { recursive: true });
  return { id, dir };
}

/** Codex thread ids are remembered on disk so a restart can resume the chat. */
export async function readThreadId(dir: string): Promise<string | null> {
  try {
    const raw = await readFile(join(dir, '.arlo-thread'), 'utf8');
    return raw.trim() || null;
  } catch {
    return null;
  }
}

export async function writeThreadId(dir: string, threadId: string): Promise<void> {
  await writeFile(join(dir, '.arlo-thread'), `${threadId}\n`, 'utf8');
}
