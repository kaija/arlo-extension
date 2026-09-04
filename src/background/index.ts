import type { BackgroundRequest, BackgroundResponse, TabInfo } from '../shared/messages';
import { isBlockedUrl, loadSettings } from '../shared/settings';
import { hasSiteAccess, syncContentScript } from './content-registration';
import {
  approvePlan,
  cancelPlan,
  decideGate,
  forgetTab,
  getRun,
  pauseRun,
  resetRun,
  resumeAfterHelp,
  resumeRun,
  stopRun,
  submitTask,
} from './run-controller';

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await syncContentScript();
});

chrome.runtime.onStartup.addListener(() => {
  void syncContentScript();
});

// Site access can be granted or revoked at any time; keep the content script in step.
chrome.permissions.onAdded.addListener(() => void syncContentScript());
chrome.permissions.onRemoved.addListener(() => void syncContentScript());

chrome.tabs.onRemoved.addListener((tabId) => forgetTab(tabId));

async function currentTab(): Promise<TabInfo | null> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return null;
  const settings = await loadSettings();
  const url = tab.url ?? '';
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }
  return {
    tabId: tab.id,
    url,
    title: tab.title ?? '',
    host,
    blocked: settings.pausedEverywhere || isBlockedUrl(url, settings.blockedDomains),
  };
}

async function handle(request: BackgroundRequest): Promise<BackgroundResponse> {
  switch (request.type) {
    case 'run:get':
      return { ok: true, state: getRun(request.tabId) };
    case 'run:submit':
      return { ok: true, state: await submitTask(request.tabId, request.prompt) };
    case 'run:approve-plan':
      return { ok: true, state: approvePlan(request.tabId) };
    case 'run:cancel':
      return { ok: true, state: cancelPlan(request.tabId) };
    case 'run:pause':
      return { ok: true, state: pauseRun(request.tabId) };
    case 'run:resume':
      return { ok: true, state: resumeRun(request.tabId) };
    case 'run:stop':
      return { ok: true, state: stopRun(request.tabId) };
    case 'run:gate':
      return { ok: true, state: decideGate(request.tabId, request.decision) };
    case 'run:resume-after-help':
      return { ok: true, state: resumeAfterHelp(request.tabId) };
    case 'run:reset':
      return { ok: true, state: resetRun(request.tabId) };
    case 'perm:status':
      return { ok: true, granted: await hasSiteAccess() };
    case 'tab:current':
      return { ok: true, tab: await currentTab() };
  }
}

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  handle(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
  // Keeps the message channel open for the async response above.
  return true;
});
