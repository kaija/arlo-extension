/**
 * The service worker is nearly empty by design: the chat streams straight from
 * the side panel to the local bridge, because an MV3 worker is torn down after
 * about thirty seconds idle and an agent turn runs for minutes.
 *
 * What is left is the one call that cannot be made from the panel — reaching a
 * model provider's /models endpoint, which needs a host permission.
 */
import type { BackgroundRequest, BackgroundResponse } from '../shared/messages';
import { listModels, publicLlmError } from './llm-client';

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
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
