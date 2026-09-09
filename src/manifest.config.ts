/** The single source of truth for the extension manifest. Built into dist/manifest.json. */

/** activeTab only exposes the page the user opened Arlo from. */
/**
 * Declared so Arlo can ask for a provider origin, or for every page at once.
 * Chrome only grants an optional host permission that the manifest already
 * lists, and it rejects `permissions.request()` outright for anything else — so
 * a profile pointed at a remote provider could never reach its /models endpoint.
 * Nothing here is granted at install: a request names either the one origin a
 * profile points at, or every page, and the user can revoke it.
 */
export const OPTIONAL_HOST_PERMISSIONS = ['http://*/*', 'https://*/*'];

export function createManifest(version: string): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: 'Arlo',
    version,
    description: 'An AI assistant with helpful suggestions for the page you are viewing.',
    minimum_chrome_version: '124',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: 'Open Arlo',
    },
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    side_panel: {
      default_path: 'sidepanel/index.html',
    },
    options_page: 'options/index.html',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage', 'tabGroups'],
    // Granted in context: the endpoint a profile points at, asked for when the
    // panel or the model list first needs it, or every page, asked for once
    // from the panel instead of a toolbar click per navigation.
    optional_host_permissions: OPTIONAL_HOST_PERMISSIONS,
  };
}
