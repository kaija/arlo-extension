/**
 * The service worker is nearly empty by design: the chat streams straight from
 * the side panel to the model, because an MV3 worker is torn down after
 * about thirty seconds idle and an agent turn runs for minutes.
 *
 * It opens the panel from a toolbar gesture and reaches a model provider's
 * /models endpoint, which needs a host permission.
 */
import type { BackgroundRequest, BackgroundResponse } from '../shared/messages';
import { listModels, publicLlmError } from './llm-client';

// Chrome's automatic side-panel toggle skips the activeTab grant. Disable the
// persisted setting from older versions, then use the normal action event so
// Chrome grants this tab access before opening the panel. See Chromium's
// ExtensionActionRunner::RunAction (crbug.com/40904917).
void chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error: unknown) => console.error('Arlo could not configure its toolbar action:', error));

chrome.action.onClicked.addListener((tab) => {
  // Call immediately: sidePanel.open requires the click's user gesture.
  void chrome.sidePanel
    .open({ windowId: tab.windowId })
    .catch((error: unknown) => console.error('Arlo could not open its side panel:', error));
});

async function handle(request: BackgroundRequest): Promise<BackgroundResponse> {
  switch (request.type) {
    case 'llm:list-models':
      return { ok: true, discovery: await listModels(request.profile) };
  }
}

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  handle(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, ...publicLlmError(error) });
    });
  // Keeps the message channel open for the async response above.
  return true;
});
