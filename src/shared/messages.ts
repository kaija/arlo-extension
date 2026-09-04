import type { RunState } from '../core/types';

/** Sent from the side panel / options page to the background service worker. */
export type BackgroundRequest =
  | { type: 'run:get'; tabId: number }
  | { type: 'run:submit'; tabId: number; prompt: string }
  | { type: 'run:approve-plan'; tabId: number }
  | { type: 'run:cancel'; tabId: number }
  | { type: 'run:pause'; tabId: number }
  | { type: 'run:resume'; tabId: number }
  | { type: 'run:stop'; tabId: number }
  | { type: 'run:gate'; tabId: number; decision: 'approve' | 'skip' | 'stop' }
  | { type: 'run:resume-after-help'; tabId: number }
  | { type: 'run:reset'; tabId: number }
  | { type: 'perm:status' }
  | { type: 'tab:current' };

/** Omit that distributes over a union, so per-variant fields survive. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A request the UI can send without knowing the tab id; the hook fills it in. */
export type UntargetedRequest = DistributiveOmit<BackgroundRequest, 'tabId'> & { tabId?: number };

export interface TabInfo {
  tabId: number;
  url: string;
  title: string;
  host: string;
  blocked: boolean;
}

export type BackgroundResponse =
  | { ok: true; state: RunState }
  | { ok: true; granted: boolean }
  | { ok: true; tab: TabInfo | null }
  | { ok: false; error: string };

/** Broadcast from the background whenever a run advances. */
export type BackgroundEvent = { type: 'run:state'; tabId: number; state: RunState };

/** Sent from the background to a content script in the operated tab. */
export type ContentRequest =
  | { type: 'content:ping' }
  | { type: 'content:highlight'; selector: string; label: string }
  | { type: 'content:clear-highlight' }
  | { type: 'content:click'; selector: string }
  | { type: 'content:type'; selector: string; value: string }
  | { type: 'content:scroll'; selector?: string }
  | { type: 'content:read' };

export type ContentResponse =
  | { ok: true; text?: string; title?: string; url?: string }
  | { ok: false; error: string; reason?: 'element_not_found' | 'sign_in_required' | 'captcha' };

export async function sendToBackground(request: BackgroundRequest): Promise<BackgroundResponse> {
  return (await chrome.runtime.sendMessage(request)) as BackgroundResponse;
}

export async function sendToContent(
  tabId: number,
  request: ContentRequest,
): Promise<ContentResponse> {
  try {
    return (await chrome.tabs.sendMessage(tabId, request)) as ContentResponse;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
