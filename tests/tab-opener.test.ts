import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseTabOpenOptions } from '../src/shared/tab-open';
import { openAgentTab } from '../src/sidepanel/tab-opener';

afterEach(() => vi.unstubAllGlobals());

function browser(groups: chrome.tabGroups.TabGroup[] = []) {
  const create = vi.fn().mockResolvedValue({ id: 42 });
  const group = vi.fn().mockResolvedValue(9);
  const query = vi.fn().mockResolvedValue(groups);
  const update = vi.fn().mockResolvedValue({
    id: 9,
    windowId: 7,
    title: 'Arlo',
    color: 'blue',
    collapsed: false,
    shared: false,
  });
  const remove = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', {
    tabs: { create, group, remove },
    tabGroups: { query, update },
  });
  return { create, group, query, update, remove };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('agent-created tabs', () => {
  it('opens a normalized URL in the panel window and creates the Arlo group', async () => {
    const { create, group, query, update } = browser();
    await expect(
      openAgentTab(7, { url: ' https://example.com/work ', active: false }),
    ).resolves.toEqual({
      ok: true,
      tab: {
        tabId: 42,
        url: 'https://example.com/work',
        windowId: 7,
        groupId: 9,
        groupTitle: 'Arlo',
      },
    });
    expect(create).toHaveBeenCalledWith({
      url: 'https://example.com/work',
      windowId: 7,
      active: false,
    });
    expect(query).toHaveBeenCalledWith({ windowId: 7, title: 'Arlo' });
    expect(group).toHaveBeenCalledWith({ tabIds: 42, createProperties: { windowId: 7 } });
    expect(update).toHaveBeenCalledWith(9, { title: 'Arlo', color: 'blue' });
  });

  it('reuses the Arlo group in the same window instead of creating another one', async () => {
    const { group, update } = browser([
      {
        id: 18,
        windowId: 7,
        title: 'Arlo',
        color: 'blue',
        collapsed: false,
        shared: false,
      },
    ]);
    group.mockResolvedValue(18);
    await expect(openAgentTab(7, { url: 'https://example.com/next' })).resolves.toMatchObject({
      ok: true,
      tab: { groupId: 18, windowId: 7 },
    });
    expect(group).toHaveBeenCalledWith({ groupId: 18, tabIds: 42 });
    expect(update).not.toHaveBeenCalled();
  });

  it('recreates a stale group rather than attaching the tab to an unmarked group', async () => {
    const first = browser();
    await openAgentTab(11, { url: 'https://example.com/first' });
    expect(first.group).toHaveBeenCalledWith({ tabIds: 42, createProperties: { windowId: 11 } });

    const second = browser([
      { id: 9, windowId: 11, title: 'Arlo', color: 'red', collapsed: false, shared: false },
    ]);
    await openAgentTab(11, { url: 'https://example.com/second' });
    expect(second.group).toHaveBeenCalledWith({ tabIds: 42, createProperties: { windowId: 11 } });
  });

  it('closes a newly created tab when grouping fails', async () => {
    const { query, remove } = browser();
    query.mockRejectedValueOnce(new Error('Missing tabGroups permission'));
    await expect(openAgentTab(7, { url: 'https://example.com' })).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'GROUP_FAILED',
        message: expect.stringMatching(/ungrouped tab was closed/),
      },
    });
    expect(remove).toHaveBeenCalledWith(42);
  });

  it('does not report success when Chrome fails to confirm group creation', async () => {
    const { update, remove } = browser();
    update.mockResolvedValueOnce(undefined);
    await expect(openAgentTab(7, { url: 'https://example.com' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'GROUP_FAILED' },
    });
    expect(remove).toHaveBeenCalledWith(42);
  });

  it('closes a tab created after its agent request was cancelled', async () => {
    const { create, group, remove } = browser();
    const created = deferred<chrome.tabs.Tab>();
    create.mockReturnValueOnce(created.promise);
    const controller = new AbortController();
    const opening = openAgentTab(23, { url: 'https://example.com/cancelled' }, controller.signal);

    controller.abort();
    created.resolve({ id: 42 } as chrome.tabs.Tab);

    await expect(opening).resolves.toMatchObject({
      ok: false,
      error: { code: 'OPEN_CANCELLED', message: expect.stringMatching(/was closed/) },
    });
    expect(group).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(42);
  });

  it('keeps a tab that was already grouped when the deadline expires', async () => {
    const { group, update, remove } = browser();
    const controller = new AbortController();
    // A stopped turn can land right as Chrome is grouping. The tab is where it
    // belongs by the time the call returns, so it must survive.
    group.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(9);
    });
    const opening = openAgentTab(7, { url: 'https://example.com/raced' }, controller.signal);

    await expect(opening).resolves.toEqual({
      ok: true,
      tab: {
        tabId: 42,
        url: 'https://example.com/raced',
        windowId: 7,
        groupId: 9,
        groupTitle: 'Arlo',
      },
    });
    expect(update).toHaveBeenCalledWith(9, { title: 'Arlo', color: 'blue' });
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('open_new_tab options', () => {
  it('allows only bounded absolute HTTP(S) URLs', () => {
    expect(parseTabOpenOptions({ url: 'https://example.com', active: true })).toEqual({
      url: 'https://example.com/',
      active: true,
    });
    for (const value of [
      undefined,
      null,
      [],
      {},
      { url: '/relative' },
      { url: 'file:///tmp/example' },
      { url: 'ftp://example.com' },
      { url: 'https://example.com', active: 'yes' },
      { url: 'https://example.com', tabId: 42 },
    ]) {
      expect(() => parseTabOpenOptions(value)).toThrow(/open_new_tab|url|active|Unknown/);
    }
  });
});
