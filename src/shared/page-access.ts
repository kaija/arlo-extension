/**
 * Reading the page normally rides on activeTab, which Chrome grants for a
 * single toolbar click and drops again on the next navigation — so every new
 * page costs another click. The same optional host permissions the manifest
 * already declares can instead be granted once, from a click in the panel, and
 * revoked any time under Site access at chrome://extensions.
 */
import { OPTIONAL_HOST_PERMISSIONS } from '../manifest.config';

/** Chrome only grants optional origins the manifest itself declared. */
const ALL_PAGES = { origins: OPTIONAL_HOST_PERMISSIONS };

export async function hasPageAccess(): Promise<boolean> {
  // Outside an extension — tests, the preview harness — there is nothing to grant.
  if (typeof chrome === 'undefined' || !chrome.permissions) return true;
  try {
    return await chrome.permissions.contains(ALL_PAGES);
  } catch {
    return false;
  }
}

/** Must run inside a click: Chrome only grants optional permissions on a gesture. */
export function requestPageAccess(): Promise<boolean> {
  return chrome.permissions.request(ALL_PAGES);
}
