/**
 * The side panel against a stubbed chrome.*. Dev-only — not a build input, so
 * it never reaches dist/.
 *
 * Point it at any OpenAI-compatible endpoint with `base`, `model` and `key`.
 * Every tab the agent opens is recorded on `globalThis.__openedTabs`, so a
 * driver can assert on what the run actually did to the browser.
 */
const params = new URLSearchParams(location.search);

const settings = {
  llmProfiles: [
    {
      id: 'profile_dev',
      name: 'Dev gateway',
      apiContract: params.get('contract') ?? 'openai-responses',
      baseUrl: params.get('base') ?? 'https://api.openai.com/v1',
      apiKey: params.get('key') ?? 'sk-not-a-real-key',
      rememberApiKey: true,
      model: params.get('model') ?? 'gpt-5.6-terra',
      modelIds: [params.get('model') ?? 'gpt-5.6-terra'],
      discovery: { status: 'available', checkedAt: Date.now(), message: 'Models loaded' },
    },
  ],
  defaultLlmProfileId: 'profile_dev',
  onboardingCompleted: true,
};

/** What the agent actually did to the browser, for a driver to assert on. */
const openedTabs: unknown[] = [];
Object.assign(globalThis, { __openedTabs: openedTabs });
let nextTabId = 500;

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
    windows: { getCurrent: async () => ({ id: 7 }) },
    tabs: {
      query: async () => [
        {
          id: 42,
          active: true,
          title: 'Inbox - Gmail',
          url: params.get('page') ?? 'https://mail.google.com/mail/u/0/#inbox',
        },
      ],
      create: async (info: unknown) => {
        openedTabs.push(info);
        return { id: (nextTabId += 1) };
      },
      group: async () => 9,
      remove: async () => undefined,
      onActivated: { addListener: noop, removeListener: noop },
      onUpdated: { addListener: noop, removeListener: noop },
    },
    tabGroups: {
      query: async () => [],
      update: async (_id: number, props: Record<string, unknown>) => ({ id: 9, ...props }),
    },
    // `granted=0` in the query string reproduces the model-access screen.
    permissions: {
      contains: async () => params.get('granted') !== '0',
      request: async () => true,
    },
  },
});

await import('../sidepanel/main');
export {};
