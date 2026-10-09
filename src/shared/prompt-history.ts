/**
 * The questions the user has sent, oldest first, so the composer can bring
 * them back with the arrow keys after the panel has been closed and reopened.
 */
const STORAGE_KEY = 'arlo:prompt-history';
export const PROMPT_HISTORY_LIMIT = 50;

function normalize(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .slice(-PROMPT_HISTORY_LIMIT);
}

export async function loadPromptHistory(): Promise<string[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalize(stored[STORAGE_KEY]);
}

/** Adds a prompt as the newest entry; sending the same text again moves it rather than repeating it. */
export function withPrompt(history: readonly string[], prompt: string): string[] {
  const text = prompt.trim();
  if (!text) return [...history];
  return [...history.filter((entry) => entry !== text), text].slice(-PROMPT_HISTORY_LIMIT);
}

export async function recordPrompt(prompt: string): Promise<string[]> {
  const next = withPrompt(await loadPromptHistory(), prompt);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
