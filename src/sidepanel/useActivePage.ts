import { useEffect, useState } from 'react';

import type { PageSnapshot } from '../core/page-suggestions';

async function readActivePage(): Promise<PageSnapshot> {
  if (!chrome.tabs?.query) return {};
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return { url: tab?.url, title: tab?.title };
  } catch {
    return {};
  }
}

/** Tracks only the active tab metadata made available by the temporary activeTab grant. */
export function useActivePage(): PageSnapshot {
  const [page, setPage] = useState<PageSnapshot>({});

  useEffect(() => {
    let live = true;
    const refresh = () => void readActivePage().then((next) => live && setPage(next));
    const onActivated = () => refresh();
    const onUpdated = (_tabId: number, change: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (
        tab.active &&
        (change.url !== undefined || change.title !== undefined || change.status === 'complete')
      )
        refresh();
    };

    refresh();
    chrome.tabs?.onActivated?.addListener(onActivated);
    chrome.tabs?.onUpdated?.addListener(onUpdated);
    return () => {
      live = false;
      chrome.tabs?.onActivated?.removeListener(onActivated);
      chrome.tabs?.onUpdated?.removeListener(onUpdated);
    };
  }, []);

  return page;
}
