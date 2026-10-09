import { describe, expect, it } from 'vitest';

import {
  PROMPT_HISTORY_LIMIT,
  loadPromptHistory,
  recordPrompt,
  withPrompt,
} from '../src/shared/prompt-history';

describe('prompt history', () => {
  it('keeps prompts across reloads, oldest first', async () => {
    await recordPrompt('first');
    await recordPrompt('second');
    expect(await loadPromptHistory()).toEqual(['first', 'second']);
  });

  it('moves a repeated prompt to the newest slot instead of duplicating it', () => {
    expect(withPrompt(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
  });

  it('ignores blank prompts and trims the rest', () => {
    expect(withPrompt(['a'], '   ')).toEqual(['a']);
    expect(withPrompt(['a'], '  b  ')).toEqual(['a', 'b']);
  });

  it('drops the oldest prompts beyond the limit', () => {
    let history: string[] = [];
    for (let i = 0; i < PROMPT_HISTORY_LIMIT + 5; i++) history = withPrompt(history, `p${i}`);
    expect(history).toHaveLength(PROMPT_HISTORY_LIMIT);
    expect(history[0]).toBe('p5');
  });

  it('survives malformed stored data', async () => {
    await chrome.storage.local.set({ 'arlo:prompt-history': ['ok', 3, '', null] });
    expect(await loadPromptHistory()).toEqual(['ok']);
  });
});
