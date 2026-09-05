/**
 * The options page against a stubbed chrome.* , so the settings UI can be seen
 * in a normal tab. Dev-only — not a build input, so it never reaches dist/.
 *
 * The stub is installed before the app is imported, which is why the import is
 * dynamic: a static import would be hoisted above it.
 */
const store = new Map<string, unknown>([
  [
    'arlo:settings',
    {
      pausedEverywhere: false,
      blockedDomains: ['accounts.google.com', 'mail.google.com'],
      gatedActions: ['submit_form', 'purchase', 'send_message', 'delete', 'sign_in'],
      historyRetentionDays: 30,
      llmProfiles: [
        {
          id: 'profile_anthropic',
          name: 'Anthropic',
          apiContract: 'anthropic-messages',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-ant-not-a-real-key',
          rememberApiKey: true,
          model: 'claude-opus-5',
          modelIds: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
          discovery: { status: 'available', checkedAt: Date.now(), message: 'Models loaded' },
        },
        {
          id: 'profile_local',
          name: 'Local llama.cpp',
          apiContract: 'openai-chat-completions',
          baseUrl: 'http://localhost:8080',
          apiKey: '',
          rememberApiKey: false,
          model: '',
          modelIds: [],
          discovery: { status: 'untested' },
        },
      ],
      defaultLlmProfileId: 'profile_anthropic',
    },
  ],
]);

const noop = () => {};
Object.assign(globalThis, {
  chrome: {
    storage: {
      local: {
        get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        },
        remove: async (key: string) => void store.delete(key),
      },
      session: {
        get: async () => ({}),
        set: async () => undefined,
        remove: async () => undefined,
      },
      onChanged: { addListener: noop, removeListener: noop },
    },
    runtime: {
      sendMessage: async () => ({ ok: true }),
      openOptionsPage: noop,
      onMessage: { addListener: noop, removeListener: noop },
    },
    permissions: { request: async () => true, contains: async () => true },
  },
});

await import('../options/main');
export {};
