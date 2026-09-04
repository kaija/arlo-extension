import { DEFAULT_GATED_ACTIONS } from '../core/gate-policy';
import type { ActionKind } from '../core/types';

export interface Settings {
  /** The global brake: when true Arlo will not act on any site. */
  pausedEverywhere: boolean;
  /** Hostnames Arlo must never operate on. */
  blockedDomains: string[];
  /** Which actions stop for confirmation. */
  gatedActions: ActionKind[];
  model: string;
  apiKey: string;
  /** 0 keeps nothing; run history older than this is dropped. */
  historyRetentionDays: number;
  onboardingCompleted: boolean;
}

/** Money and mail are blocked out of the box; the user can edit the list. */
export const DEFAULT_BLOCKED_DOMAINS = [
  'accounts.google.com',
  'mail.google.com',
  'outlook.com',
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'paypal.com',
];

export const DEFAULT_SETTINGS: Settings = {
  pausedEverywhere: false,
  blockedDomains: DEFAULT_BLOCKED_DOMAINS,
  gatedActions: DEFAULT_GATED_ACTIONS,
  model: 'claude-opus-5',
  apiKey: '',
  historyRetentionDays: 30,
  onboardingCompleted: false,
};

const STORAGE_KEY = 'arlo:settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local' || !(STORAGE_KEY in changes)) return;
    listener({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY]?.newValue as Partial<Settings>) });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/**
 * A URL is off-limits if it is on the block list or is not an ordinary web
 * page. Subdomains of a blocked domain are blocked too.
 */
export function isBlockedUrl(url: string, blockedDomains: readonly string[]): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    host = parsed.hostname.toLowerCase();
  } catch {
    return true;
  }
  return blockedDomains.some((raw) => {
    const domain = raw.trim().toLowerCase().replace(/^\./, '');
    if (!domain) return false;
    return host === domain || host.endsWith(`.${domain}`);
  });
}
