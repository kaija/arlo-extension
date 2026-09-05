/** The single source of truth for the extension manifest. Built into dist/manifest.json. */

/** Model traffic uses loopback. activeTab only exposes the page the user opened Arlo from. */
export const BRIDGE_HOST_PERMISSIONS = ['http://127.0.0.1/*', 'http://localhost/*'];

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
    permissions: ['activeTab', 'sidePanel', 'storage'],
    // Granted in context from settings, once a bridge URL is configured.
    optional_host_permissions: BRIDGE_HOST_PERMISSIONS,
  };
}
