/**
 * The side panel against a stubbed chrome.*, pointed at a real running bridge.
 * Dev-only — not a build input, so it never reaches dist/.
 *
 * Start the bridge so it accepts this page's origin:
 *   ARLO_ALLOWED_ORIGINS=http://localhost:5199 ARLO_BRIDGE_TOKEN=dev npm start
 */
const params = new URLSearchParams(location.search);

const settings = {
  llmProfiles: [
    {
      id: 'profile_dev',
      name: 'Dev gateway',
      apiContract: 'openai-responses',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: params.get('key') ?? 'sk-not-a-real-key',
      rememberApiKey: true,
      model: 'gpt-5.6-terra',
      modelIds: ['gpt-5.6-terra'],
      discovery: { status: 'available', checkedAt: Date.now(), message: 'Models loaded' },
    },
  ],
  defaultLlmProfileId: 'profile_dev',
  bridgeUrl: params.get('bridge') ?? 'http://localhost:4319',
  bridgeToken: params.get('token') ?? 'dev',
  onboardingCompleted: true,
};

const noop = () => {};
Object.assign(globalThis, {
  chrome: {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: settings }),
        set: async () => undefined,
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
      onChanged: { addListener: noop, removeListener: noop },
    },
    runtime: {
      sendMessage: async () => ({ ok: true }),
      openOptionsPage: noop,
      onMessage: { addListener: noop, removeListener: noop },
    },
    tabs: {
      query: async () => [
        {
          active: true,
          title: 'Inbox - Gmail',
          url: params.get('page') ?? 'https://mail.google.com/mail/u/0/#inbox',
        },
      ],
      onActivated: { addListener: noop, removeListener: noop },
      onUpdated: { addListener: noop, removeListener: noop },
    },
    // `granted=0` in the query string reproduces the blocked-permission screen.
    permissions: {
      contains: async () => params.get('granted') !== '0',
      request: async () => true,
    },
  },
});

await import('../sidepanel/main');
export {};
