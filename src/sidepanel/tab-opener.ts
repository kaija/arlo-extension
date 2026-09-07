import {
  ARLO_TAB_GROUP_TITLE,
  parseTabOpenOptions,
  tabOpenFailure,
  TabOpenError,
  type TabOpenResult,
} from '../shared/tab-open';

const arloGroupByWindow = new Map<number, number>();
const ARLO_TAB_GROUP_COLOR = 'blue' as const;

function unavailable(): never {
  throw new TabOpenError(
    'OPENER_UNAVAILABLE',
    'Chrome tab groups are unavailable in this Arlo panel. Reload Arlo at chrome://extensions, then retry.',
  );
}

function cancelled(removed = false): TabOpenError {
  return new TabOpenError(
    'OPEN_CANCELLED',
    `The agent tab request was cancelled.${
      removed ? ' The newly created tab was closed.' : ' The tab may still be open.'
    }`,
  );
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw cancelled();
}

async function closeCreatedTab(tabId: number): Promise<boolean> {
  if (typeof chrome.tabs.remove !== 'function') return false;
  try {
    await chrome.tabs.remove(tabId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a tab in the panel's window and keep all agent-created tabs in one
 * clearly named group. The caller supplies the window ID from the side panel,
 * never from an agent-controlled tool argument.
 */
export async function openAgentTab(
  windowId: number,
  input: unknown,
  signal?: AbortSignal,
): Promise<TabOpenResult> {
  let createdTabId: number | undefined;
  try {
    const options = parseTabOpenOptions(input);
    if (
      typeof chrome === 'undefined' ||
      !chrome.tabs?.create ||
      !chrome.tabs.group ||
      !chrome.tabGroups?.query ||
      !chrome.tabGroups.update
    )
      unavailable();

    throwIfCancelled(signal);
    const tab = await chrome.tabs.create({ url: options.url, windowId, active: options.active });
    if (tab.id === undefined)
      throw new TabOpenError('OPEN_FAILED', 'Chrome created a tab without an identifier.');
    createdTabId = tab.id;

    throwIfCancelled(signal);
    const groups = await chrome.tabGroups.query({ windowId, title: ARLO_TAB_GROUP_TITLE });
    const rememberedGroupId = arloGroupByWindow.get(windowId);
    const existing =
      groups.find(
        (group) =>
          group.id === rememberedGroupId &&
          group.title === ARLO_TAB_GROUP_TITLE &&
          group.color === ARLO_TAB_GROUP_COLOR,
      ) ??
      groups.find(
        (group) => group.title === ARLO_TAB_GROUP_TITLE && group.color === ARLO_TAB_GROUP_COLOR,
      );

    // The last point at which giving up is free. Past the grouping call the tab
    // is already where it belongs, so a check after this one would close a tab
    // that had opened correctly.
    throwIfCancelled(signal);
    const groupId = await chrome.tabs.group(
      existing
        ? { groupId: existing.id, tabIds: tab.id }
        : { tabIds: tab.id, createProperties: { windowId } },
    );
    if (!existing) {
      const updated = await chrome.tabGroups.update(groupId, {
        title: ARLO_TAB_GROUP_TITLE,
        color: ARLO_TAB_GROUP_COLOR,
      });
      if (
        !updated ||
        updated.title !== ARLO_TAB_GROUP_TITLE ||
        updated.color !== ARLO_TAB_GROUP_COLOR
      ) {
        throw new Error('Chrome did not confirm creation of the Arlo tab group.');
      }
    }
    arloGroupByWindow.set(windowId, groupId);

    return {
      ok: true,
      tab: {
        tabId: tab.id,
        url: options.url,
        windowId,
        groupId,
        groupTitle: ARLO_TAB_GROUP_TITLE,
      },
    };
  } catch (cause) {
    if (createdTabId === undefined) return tabOpenFailure(cause);

    const removed = await closeCreatedTab(createdTabId);
    if (signal?.aborted || (cause instanceof TabOpenError && cause.code === 'OPEN_CANCELLED')) {
      return tabOpenFailure(cancelled(removed));
    }

    const message = cause instanceof Error ? cause.message : String(cause);
    return tabOpenFailure(
      new TabOpenError(
        'GROUP_FAILED',
        `Chrome could not add the new tab to the Arlo tab group: ${message}${
          removed
            ? ' The ungrouped tab was closed.'
            : ' The tab may still be open outside the group.'
        }`,
      ),
    );
  }
}
