/** The single source of truth for the extension manifest. Built into dist/manifest.json. */

/**
 * The agent runs in a local bridge process, not in the page, so the extension
 * needs no access to the sites you visit — only to loopback.
 */
export const BRIDGE_HOST_PERMISSION = 'http://127.0.0.1/*';

export function createManifest(version: string): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: 'Arlo',
    version,
    description:
      'Chat with a Codex agent from the Chrome side panel. Each conversation runs in a sandboxed folder of its own.',
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
    permissions: ['sidePanel', 'storage'],
    // Granted in context from settings, once a bridge URL is configured.
    optional_host_permissions: [BRIDGE_HOST_PERMISSION],
  };
}
