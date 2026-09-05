import type { LlmApiContract, LlmProfile, ModelDiscoveryStatus } from './settings';

export interface LlmDiagnostic {
  endpoint: string;
  apiContract: LlmApiContract;
  status?: number;
  requestId?: string;
  responseExcerpt?: string;
}

export interface ModelDiscoveryResult {
  status: Exclude<ModelDiscoveryStatus, 'untested'>;
  models: string[];
  checkedAt: number;
  message: string;
  diagnostic?: LlmDiagnostic;
}

/**
 * The chat itself runs panel-to-bridge over HTTP, so the service worker is left
 * with one job: reaching a model provider's /models endpoint, which needs a
 * host permission the panel does not hold.
 */
export type BackgroundRequest = { type: 'llm:list-models'; profile: LlmProfile };

export type BackgroundResponse =
  | { ok: true; discovery: ModelDiscoveryResult }
  | { ok: false; error: string; diagnostic?: LlmDiagnostic };

export async function sendToBackground(request: BackgroundRequest): Promise<BackgroundResponse> {
  return (await chrome.runtime.sendMessage(request)) as BackgroundResponse;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
