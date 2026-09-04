import { useCallback, useEffect, useState } from 'react';

import { initialRunState } from '../core/run-machine';
import type { RunState } from '../core/types';
import { HOST_PERMISSION } from '../manifest.config';
import {
  sendToBackground,
  type BackgroundEvent,
  type BackgroundRequest,
  type TabInfo,
  type UntargetedRequest,
} from '../shared/messages';

export interface Arlo {
  tab: TabInfo | null;
  state: RunState;
  granted: boolean;
  error: string | null;
  loading: boolean;
  requestSiteAccess: () => Promise<void>;
  send: (request: UntargetedRequest) => Promise<void>;
  submit: (prompt: string) => Promise<void>;
  dismissError: () => void;
}

export function useArlo(): Arlo {
  const [tab, setTab] = useState<TabInfo | null>(null);
  const [state, setState] = useState<RunState>(initialRunState);
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** One read of everything the panel shows: permission, active tab, its run. */
  const readSnapshot = useCallback(async () => {
    const permission = await sendToBackground({ type: 'perm:status' });
    const current = await sendToBackground({ type: 'tab:current' });
    const activeTab = 'tab' in current ? current.tab : null;
    const run = activeTab
      ? await sendToBackground({ type: 'run:get', tabId: activeTab.tabId })
      : null;

    return {
      granted: 'granted' in permission ? permission.granted : false,
      tab: activeTab,
      state: run && 'state' in run ? run.state : null,
    };
  }, []);

  useEffect(() => {
    // Chrome is the source of truth here; the panel subscribes to it and drops
    // any snapshot that lands after the panel has moved on.
    let live = true;

    const sync = () => {
      void readSnapshot().then((snapshot) => {
        if (!live) return;
        setGranted(snapshot.granted);
        setTab(snapshot.tab);
        if (snapshot.state) setState(snapshot.state);
      });
    };

    const onEvent = (message: BackgroundEvent) => {
      if (message?.type === 'run:state') setState(message.state);
    };

    sync();
    chrome.runtime.onMessage.addListener(onEvent);
    chrome.tabs.onActivated.addListener(sync);
    chrome.tabs.onUpdated.addListener(sync);

    return () => {
      live = false;
      chrome.runtime.onMessage.removeListener(onEvent);
      chrome.tabs.onActivated.removeListener(sync);
      chrome.tabs.onUpdated.removeListener(sync);
    };
  }, [readSnapshot]);

  const send: Arlo['send'] = useCallback(
    async (request) => {
      const tabId = request.tabId ?? tab?.tabId;
      if (tabId === undefined) return;
      setLoading(true);
      try {
        const response = await sendToBackground({ ...request, tabId } as BackgroundRequest);
        if ('state' in response) setState(response.state);
        if (response.ok === false) setError(response.error);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setLoading(false);
      }
    },
    [tab?.tabId],
  );

  const submit = useCallback(
    async (prompt: string) => {
      setError(null);
      await send({ type: 'run:submit', prompt });
    },
    [send],
  );

  /**
   * Must run inside the click handler: Chrome only grants optional permissions
   * during a user gesture, so this cannot move into the service worker.
   */
  const requestSiteAccess = useCallback(async () => {
    setGranted(await chrome.permissions.request({ origins: [HOST_PERMISSION] }));
  }, []);

  return {
    tab,
    state,
    granted,
    error,
    loading,
    requestSiteAccess,
    send,
    submit,
    dismissError: () => setError(null),
  };
}
