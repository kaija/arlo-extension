import { beforeEach, vi } from 'vitest';

type Listener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: chrome.storage.AreaName,
) => void;

const store = new Map<string, unknown>();
const sessionStore = new Map<string, unknown>();
const listeners = new Set<Listener>();

/** Just enough of the chrome API for the units under test. */
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        const value = store.get(key);
        return value === undefined ? {} : { [key]: value };
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [key, newValue] of Object.entries(items)) {
          const oldValue = store.get(key);
          store.set(key, newValue);
          for (const listener of listeners) listener({ [key]: { oldValue, newValue } }, 'local');
        }
      }),
      remove: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    },
    session: {
      get: vi.fn(async (key: string) => {
        const value = sessionStore.get(key);
        return value === undefined ? {} : { [key]: value };
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) sessionStore.set(key, value);
      }),
      remove: vi.fn(async (key: string) => {
        sessionStore.delete(key);
      }),
    },
    onChanged: {
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
    },
  },
  runtime: {
    sendMessage: vi.fn(async () => ({ ok: true })),
    openOptionsPage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
};

Object.assign(globalThis, { chrome: chromeMock });

beforeEach(() => {
  store.clear();
  sessionStore.clear();
  listeners.clear();
  vi.clearAllMocks();
});
