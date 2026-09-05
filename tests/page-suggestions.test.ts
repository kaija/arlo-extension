import { describe, expect, it } from 'vitest';

import { suggestionsForPage } from '../src/core/page-suggestions';

describe('suggestionsForPage', () => {
  it('returns the three safe default suggestions without a readable page URL', () => {
    const result = suggestionsForPage({});

    expect(result.id).toBe('default');
    expect(result.prompts).toHaveLength(3);
    expect(result.description).not.toContain('Codex');
  });

  it.each(['https://mail.google.com/mail/u/0/', 'https://mail.google.com/mail/u/0/#inbox'])(
    'returns Gmail home suggestions for %s',
    (url) => {
      const result = suggestionsForPage({ url, title: 'Inbox - Gmail' });

      expect(result.id).toBe('gmail-home');
      expect(result.prompts).toEqual([
        'Summarize important unread emails and flag anything urgent',
        'Find messages that need a reply today',
        'Draft replies to the most important emails, but ask before sending',
      ]);
    },
  );

  it('falls back on a Gmail message page instead of assuming inbox context', () => {
    expect(suggestionsForPage({ url: 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQx' }).id).toBe(
      'default',
    );
  });

  it('falls back for invalid and unrelated URLs', () => {
    expect(suggestionsForPage({ url: 'not a URL' }).id).toBe('default');
    expect(suggestionsForPage({ url: 'https://example.com/work' }).id).toBe('default');
  });
});
