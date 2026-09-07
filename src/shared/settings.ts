import { isThemePreference, type ThemePreference } from './theme';

export const LLM_API_CONTRACTS = [
  'anthropic-messages',
  'openai-responses',
  'openai-chat-completions',
] as const;

export type LlmApiContract = (typeof LLM_API_CONTRACTS)[number];
export type ModelDiscoveryStatus = 'untested' | 'available' | 'unavailable' | 'failed';

export interface ModelDiscoveryState {
  status: ModelDiscoveryStatus;
  checkedAt?: number;
  message?: string;
}

export interface LlmProfile {
  id: string;
  name: string;
  apiContract: LlmApiContract;
  baseUrl: string;
  model: string;
  apiKey: string;
  rememberApiKey: boolean;
  modelIds: string[];
  discovery: ModelDiscoveryState;
  /** Exact origins acknowledged by the user. Changed origins require consent again. */
  dataOriginAcknowledged?: string;
  insecureOriginAcknowledged?: string;
}

export interface LlmProfileSummary {
  id: string;
  name: string;
  apiContract: LlmApiContract;
  model: string;
  origin: string;
}

export interface Settings {
  llmProfiles: LlmProfile[];
  defaultLlmProfileId: string | null;
  /** Dark, light, or whatever the OS is set to. */
  theme: ThemePreference;
  onboardingCompleted: boolean;
}

/** Money and mail are blocked out of the box; the user can edit the list. */
export const DEFAULT_SETTINGS: Settings = {
  llmProfiles: [],
  defaultLlmProfileId: null,
  theme: 'system',
  onboardingCompleted: false,
};

const STORAGE_KEY = 'arlo:settings';
const SESSION_KEYS_STORAGE_KEY = 'arlo:llm-session-keys';

const CONTRACT_DEFAULTS: Record<LlmApiContract, { name: string; baseUrl: string }> = {
  'anthropic-messages': { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  'openai-responses': { name: 'OpenAI Responses', baseUrl: 'https://api.openai.com/v1' },
  'openai-chat-completions': {
    name: 'OpenAI Chat Completions',
    baseUrl: 'https://api.openai.com/v1',
  },
};

export function createLlmProfile(apiContract: LlmApiContract): LlmProfile {
  const defaults = CONTRACT_DEFAULTS[apiContract];
  return {
    id: `profile_${crypto.randomUUID().slice(0, 8)}`,
    name: defaults.name,
    apiContract,
    baseUrl: defaults.baseUrl,
    model: '',
    apiKey: '',
    rememberApiKey: true,
    modelIds: [],
    discovery: { status: 'untested' },
  };
}

export function contractDefaultBaseUrl(apiContract: LlmApiContract): string {
  return CONTRACT_DEFAULTS[apiContract].baseUrl;
}

export function contractLabel(apiContract: LlmApiContract): string {
  switch (apiContract) {
    case 'anthropic-messages':
      return 'Anthropic Messages';
    case 'openai-responses':
      return 'OpenAI Responses';
    case 'openai-chat-completions':
      return 'OpenAI Chat Completions';
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function profileOrigin(profile: Pick<LlmProfile, 'baseUrl'>): string {
  return new URL(normalizeBaseUrl(profile.baseUrl)).origin;
}

export function profileEndpoint(profile: Pick<LlmProfile, 'apiContract' | 'baseUrl'>): string {
  const path =
    profile.apiContract === 'anthropic-messages'
      ? 'messages'
      : profile.apiContract === 'openai-responses'
        ? 'responses'
        : 'chat/completions';
  return `${normalizeBaseUrl(profile.baseUrl)}/${path}`;
}

export function profileModelsEndpoint(profile: Pick<LlmProfile, 'baseUrl'>): string {
  return `${normalizeBaseUrl(profile.baseUrl)}/models`;
}

export function validateLlmProfile(profile: LlmProfile): string[] {
  const errors: string[] = [];
  if (!profile.name.trim()) errors.push('Profile name is required.');
  if (!profile.model.trim()) errors.push('Model is required.');
  try {
    const parsed = new URL(normalizeBaseUrl(profile.baseUrl));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      errors.push('Base URL must use HTTP or HTTPS.');
    }
  } catch {
    errors.push('Enter a valid Base URL.');
  }
  return errors;
}

export function isRemoteHttpOrigin(origin: string): boolean {
  const parsed = new URL(origin);
  if (parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase();
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]' && host !== '::1';
}

export function getDefaultLlmProfile(settings: Settings): LlmProfile | null {
  if (!settings.defaultLlmProfileId) return null;
  return (
    settings.llmProfiles.find((profile) => profile.id === settings.defaultLlmProfileId) ?? null
  );
}

export function getDefaultLlmProfileSummary(settings: Settings): LlmProfileSummary | null {
  const profile = getDefaultLlmProfile(settings);
  if (!profile) return null;
  let origin = '';
  try {
    origin = profileOrigin(profile);
  } catch {
    // An invalid draft cannot be used, but old storage must not break the panel.
  }
  return {
    id: profile.id,
    name: profile.name,
    apiContract: profile.apiContract,
    model: profile.model,
    origin,
  };
}

function isApiContract(value: unknown): value is LlmApiContract {
  return typeof value === 'string' && LLM_API_CONTRACTS.includes(value as LlmApiContract);
}

function normalizeDiscovery(value: unknown): ModelDiscoveryState {
  if (!value || typeof value !== 'object') return { status: 'untested' };
  const candidate = value as Partial<ModelDiscoveryState>;
  const validStatuses: ModelDiscoveryStatus[] = ['untested', 'available', 'unavailable', 'failed'];
  return {
    status: validStatuses.includes(candidate.status as ModelDiscoveryStatus)
      ? (candidate.status as ModelDiscoveryStatus)
      : 'untested',
    ...(typeof candidate.checkedAt === 'number' ? { checkedAt: candidate.checkedAt } : {}),
    ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}),
  };
}

function normalizeProfile(value: unknown): LlmProfile | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<LlmProfile>;
  if (typeof candidate.id !== 'string' || !isApiContract(candidate.apiContract)) return null;
  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' ? candidate.name : '',
    apiContract: candidate.apiContract,
    baseUrl:
      typeof candidate.baseUrl === 'string'
        ? candidate.baseUrl
        : contractDefaultBaseUrl(candidate.apiContract),
    model: typeof candidate.model === 'string' ? candidate.model : '',
    apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : '',
    rememberApiKey: candidate.rememberApiKey !== false,
    modelIds: Array.isArray(candidate.modelIds)
      ? candidate.modelIds.filter((model): model is string => typeof model === 'string')
      : [],
    discovery: normalizeDiscovery(candidate.discovery),
    ...(typeof candidate.dataOriginAcknowledged === 'string'
      ? { dataOriginAcknowledged: candidate.dataOriginAcknowledged }
      : {}),
    ...(typeof candidate.insecureOriginAcknowledged === 'string'
      ? { insecureOriginAcknowledged: candidate.insecureOriginAcknowledged }
      : {}),
  };
}

function normalizeSettings(value: unknown): Settings {
  const candidate = value && typeof value === 'object' ? (value as Partial<Settings>) : {};
  const llmProfiles = Array.isArray(candidate.llmProfiles)
    ? candidate.llmProfiles
        .map(normalizeProfile)
        .filter((profile): profile is LlmProfile => !!profile)
    : [];
  const defaultLlmProfileId =
    typeof candidate.defaultLlmProfileId === 'string' &&
    llmProfiles.some((profile) => profile.id === candidate.defaultLlmProfileId)
      ? candidate.defaultLlmProfileId
      : null;
  return {
    llmProfiles,
    defaultLlmProfileId,
    theme: isThemePreference(candidate.theme) ? candidate.theme : DEFAULT_SETTINGS.theme,
    onboardingCompleted:
      typeof candidate.onboardingCompleted === 'boolean'
        ? candidate.onboardingCompleted
        : DEFAULT_SETTINGS.onboardingCompleted,
  };
}

async function loadSessionKeys(): Promise<Record<string, string>> {
  const stored = await chrome.storage.session.get(SESSION_KEYS_STORAGE_KEY);
  const value = stored[SESSION_KEYS_STORAGE_KEY];
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export async function loadSettings(): Promise<Settings> {
  const [stored, sessionKeys] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    loadSessionKeys(),
  ]);
  const settings = normalizeSettings(stored[STORAGE_KEY]);
  return {
    ...settings,
    llmProfiles: settings.llmProfiles.map((profile) =>
      profile.rememberApiKey ? profile : { ...profile, apiKey: sessionKeys[profile.id] ?? '' },
    ),
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  const sessionKeys = Object.fromEntries(
    next.llmProfiles
      .filter((profile) => !profile.rememberApiKey && profile.apiKey)
      .map((profile) => [profile.id, profile.apiKey]),
  );
  const persisted: Settings = {
    ...next,
    llmProfiles: next.llmProfiles.map((profile) =>
      profile.rememberApiKey ? profile : { ...profile, apiKey: '' },
    ),
  };
  await Promise.all([
    chrome.storage.local.set({ [STORAGE_KEY]: persisted }),
    chrome.storage.session.set({ [SESSION_KEYS_STORAGE_KEY]: sessionKeys }),
  ]);
  return next;
}

export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local' || !(STORAGE_KEY in changes)) return;
    listener(normalizeSettings(changes[STORAGE_KEY]?.newValue));
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
