import { HOST_PERMISSION } from '../manifest.config';

const SCRIPT_ID = 'arlo-operator';

export async function hasSiteAccess(): Promise<boolean> {
  return chrome.permissions.contains({ origins: [HOST_PERMISSION] });
}

/**
 * The content script is registered at runtime rather than declared in the
 * manifest, because site access is optional and granted during onboarding.
 */
export async function syncContentScript(): Promise<void> {
  const granted = await hasSiteAccess();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });

  if (!granted) {
    if (existing.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return;
  }
  if (existing.length > 0) return;

  await chrome.scripting.registerContentScripts([
    {
      id: SCRIPT_ID,
      js: ['content.js'],
      matches: ['http://*/*', 'https://*/*'],
      runAt: 'document_idle',
      allFrames: false,
    },
  ]);
}

/** Injects the content script into an already-open tab that predates the grant. */
export async function ensureInjected(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}
