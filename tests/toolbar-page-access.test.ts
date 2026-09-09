import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';

import { createManifest } from '../src/manifest.config';
import { readCurrentTab } from '../src/sidepanel/page-reader';

afterEach(() => vi.unstubAllGlobals());

it('upgrades auto-open behavior so a toolbar click grants access before opening the panel', async () => {
  vi.resetModules();
  let autoOpen = true; // The old version saved this behavior in Chrome.
  let granted = false;
  let userGesture = false;
  const installed: (() => unknown)[] = [];
  const clicked: ((tab: chrome.tabs.Tab) => unknown)[] = [];
  const tab = { id: 42, windowId: 7, active: true } as chrome.tabs.Tab;
  const open = vi.fn(async () => {
    expect(userGesture).toBe(true);
    expect(granted).toBe(true);
  });
  const executeScript = vi.fn(async () => {
    if (!granted)
      throw new Error(
        'Cannot access contents of url "https://news.example.test/". Extension manifest must request permission to access this host.',
      );
    return [
      {
        result: {
          html: '<h1>News today</h1><p>The lead story.</p>',
          url: 'https://news.example.test/',
          baseUrl: 'https://news.example.test/',
          title: 'News today',
          capturedAt: new Date().toISOString(),
        },
      },
    ];
  });
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: { addListener: (fn: () => unknown) => installed.push(fn) },
      onMessage: { addListener: vi.fn() },
    },
    action: {
      onClicked: { addListener: (fn: (tab: chrome.tabs.Tab) => unknown) => clicked.push(fn) },
    },
    sidePanel: {
      setPanelBehavior: vi.fn(
        async ({ openPanelOnActionClick }: { openPanelOnActionClick: boolean }) => {
          autoOpen = openPanelOnActionClick;
        },
      ),
      open,
    },
    tabs: { query: vi.fn(async () => [tab]) },
    scripting: { executeScript },
  });

  await import('../src/background/index');
  for (const onInstalled of installed) await onInstalled();

  // Chromium's ExtensionActionRunner returns before GrantTabPermissions and
  // onClicked when openPanelOnActionClick is true. Replay that API contract.
  userGesture = true;
  if (!autoOpen) {
    granted = true;
    for (const onClicked of clicked) onClicked(tab);
  }
  userGesture = false;

  const result = await readCurrentTab(tab.windowId, {});
  expect(result).toMatchObject({ ok: true, page: { content: '# News today\n\nThe lead story.' } });
  expect(open).toHaveBeenCalledWith({ windowId: tab.windowId });
  expect(executeScript).toHaveBeenCalledTimes(1);
});

it('offers the standing grant as exactly the origins the manifest declares', async () => {
  vi.resetModules();
  const contains = vi.fn(async (_ask: chrome.permissions.Permissions) => false);
  const request = vi.fn(async (_ask: chrome.permissions.Permissions) => true);
  vi.stubGlobal('chrome', { permissions: { contains, request } });

  const { hasPageAccess, requestPageAccess } = await import('../src/shared/page-access');
  expect(await hasPageAccess()).toBe(false);
  expect(await requestPageAccess()).toBe(true);

  // Chrome rejects a request for anything optional_host_permissions omits.
  const declared = createManifest('0.0.0').optional_host_permissions;
  expect(contains.mock.calls[0]?.[0].origins).toEqual(declared);
  expect(request.mock.calls[0]?.[0].origins).toEqual(declared);
});
