/** The read-only contract shared by the browser and the local agent bridge. */
export const TAB_READ_MAX_CHARS = 24_000;
export const TAB_READ_DEFAULT_CHARS = 12_000;
export type TabReadLevel = 'compact' | 'detailed' | 'html';

export interface TabReadOptions {
  level: TabReadLevel;
  selector?: string;
  offset: number;
  maxChars: number;
  snapshotId?: string;
}

export interface TabPage {
  tabId: number;
  url: string;
  title: string;
  capturedAt: string;
  level: TabReadLevel;
  scope: 'main-frame';
  content: string;
  totalChars: number;
  offset: number;
  nextOffset: number | null;
  snapshotId: string;
}

export type TabReadResult =
  { ok: true; page: TabPage } | { ok: false; error: { code: string; message: string } };

export interface TabReadRequest {
  requestId: string;
  options: TabReadOptions;
}

export class TabReadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function tabReadFailure(cause: unknown): TabReadResult {
  return {
    ok: false,
    error: {
      code: cause instanceof TabReadError ? cause.code : 'READ_FAILED',
      message: cause instanceof Error ? cause.message : String(cause),
    },
  };
}

export function parseTabReadOptions(value: unknown = {}): TabReadOptions {
  const invalid = (message: string): never => {
    throw new TabReadError('INVALID_ARGUMENT', message);
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('Expected a read_current_tab options object.');
  }
  const args = value as Record<string, unknown>;
  const allowed = ['level', 'selector', 'offset', 'maxChars', 'snapshotId'];
  if (Object.keys(args).some((key) => !allowed.includes(key))) {
    return invalid('Unknown read_current_tab option.');
  }
  const level = args.level ?? 'compact';
  if (level !== 'compact' && level !== 'detailed' && level !== 'html') {
    return invalid('level must be compact, detailed, or html.');
  }
  const offset = args.offset ?? 0;
  const maxChars = args.maxChars ?? TAB_READ_DEFAULT_CHARS;
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
    return invalid('offset must be a nonnegative integer.');
  }
  if (
    typeof maxChars !== 'number' ||
    !Number.isInteger(maxChars) ||
    maxChars < 1 ||
    maxChars > TAB_READ_MAX_CHARS
  ) {
    return invalid(`maxChars must be between 1 and ${TAB_READ_MAX_CHARS}.`);
  }
  const { selector, snapshotId } = args;
  if (
    selector !== undefined &&
    (typeof selector !== 'string' || !selector.trim() || selector.length > 1000)
  ) {
    return invalid('selector must be a nonempty CSS selector of at most 1000 characters.');
  }
  if (
    snapshotId !== undefined &&
    (typeof snapshotId !== 'string' || !/^[a-f0-9]{64}$/.test(snapshotId))
  ) {
    return invalid('snapshotId must be the fingerprint returned by an earlier read.');
  }
  if (offset > 0 && !snapshotId) return invalid('Continuing a read requires snapshotId.');
  return {
    level,
    offset,
    maxChars,
    ...(selector === undefined ? {} : { selector: selector as string }),
    ...(snapshotId === undefined ? {} : { snapshotId: snapshotId as string }),
  };
}
