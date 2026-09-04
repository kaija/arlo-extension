/** The single source of truth for the extension manifest. Built into dist/manifest.json. */
export const HOST_PERMISSION = '<all_urls>';

export function createManifest(version: string): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: 'Arlo',
    version,
    description:
      'An agentic browser operator. Give Arlo a task and it works the tab you are looking at — with a plan you approve first.',
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
    permissions: ['sidePanel', 'storage', 'scripting', 'tabs'],
    // Site access is requested once from the onboarding screen rather than at
    // install time, so the user grants it in context (design A2).
    optional_host_permissions: [HOST_PERMISSION],
  };
}
