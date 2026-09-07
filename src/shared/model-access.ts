/**
 * Chrome's permission for the one origin a profile talks to.
 *
 * The panel makes the model call itself, so it needs host access to the
 * profile's own origin — the manifest declares `http://*` and `https://*` as
 * optional purely so a single concrete origin can be asked for here, at the
 * moment it is needed, and revoked afterwards.
 */

/**
 * Match patterns carry no port, so a configured one is dropped on purpose.
 * Returns null for anything that cannot be asked for.
 */
export function originPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

export async function hasHostAccess(pattern: string): Promise<boolean> {
  // Outside an extension — tests, the preview harness — there is nothing to grant.
  if (typeof chrome === 'undefined' || !chrome.permissions) return true;
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

/** Must run inside a click: Chrome only grants optional permissions on a gesture. */
export async function requestHostAccess(pattern: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [pattern] });
}
