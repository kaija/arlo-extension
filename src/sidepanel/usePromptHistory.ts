import { useCallback, useEffect, useState } from 'react';

import { loadPromptHistory, recordPrompt, withPrompt } from '../shared/prompt-history';

/** Sent prompts, oldest first, kept across panel sessions. */
export function usePromptHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    void loadPromptHistory()
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  const record = useCallback((prompt: string) => {
    // Update at once so the arrow keys see it; storage catches up behind.
    setHistory((current) => withPrompt(current, prompt));
    void recordPrompt(prompt).catch(() => undefined);
  }, []);

  return { history, record };
}
