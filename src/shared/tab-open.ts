/** The contract for the tab the agent opens. */
export const ARLO_TAB_GROUP_TITLE = 'Arlo';

export interface TabOpenOptions {
  /** A normalized HTTP(S) URL. */
  url: string;
  /** Whether Chrome should focus the tab it creates. */
  active: boolean;
}

export interface OpenedTab {
  tabId: number;
  url: string;
  windowId: number;
  groupId: number;
  groupTitle: typeof ARLO_TAB_GROUP_TITLE;
}

export type TabOpenResult =
  { ok: true; tab: OpenedTab } | { ok: false; error: { code: string; message: string } };

export class TabOpenError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function tabOpenFailure(cause: unknown): TabOpenResult {
  return {
    ok: false,
    error: {
      code: cause instanceof TabOpenError ? cause.code : 'OPEN_FAILED',
      message: cause instanceof Error ? cause.message : String(cause),
    },
  };
}

/** Parse the deliberately small input surface exposed to the agent. */
export function parseTabOpenOptions(value: unknown = {}): TabOpenOptions {
  const invalid = (message: string): never => {
    throw new TabOpenError('INVALID_ARGUMENT', message);
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('Expected an open_new_tab options object.');
  }
  const args = value as Record<string, unknown>;
  if (Object.keys(args).some((key) => key !== 'url' && key !== 'active')) {
    return invalid('Unknown open_new_tab option.');
  }
  if (typeof args.url !== 'string' || !args.url.trim() || args.url.length > 8_192) {
    return invalid('url must be a nonempty URL of at most 8192 characters.');
  }

  let url: URL;
  try {
    url = new URL(args.url);
  } catch {
    return invalid('url must be an absolute HTTP(S) URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return invalid('url must use the http or https scheme.');
  }
  if (args.active !== undefined && typeof args.active !== 'boolean') {
    return invalid('active must be a boolean.');
  }

  return { url: url.href, active: args.active ?? true };
}
