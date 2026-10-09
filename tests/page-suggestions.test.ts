import { describe, expect, it } from 'vitest';

import { pickSuggestions, suggestionsForPage } from '../src/core/page-suggestions';
import { LANGUAGES } from '../src/shared/language';

const GMAIL = 'https://mail.google.com/mail/u/0/';

describe('suggestionsForPage', () => {
  it('falls back to the generic set without a readable page URL, in English by default', () => {
    const result = suggestionsForPage({});

    expect(result.id).toBe('default');
    expect(result.eyebrow).toBe('Try one of these');
    expect(result.pool.length).toBeGreaterThan(3);
    expect(result.description).not.toContain('Codex');
  });

  it.each([GMAIL, `${GMAIL}#inbox`])('returns Gmail home suggestions for %s', (url) => {
    const result = suggestionsForPage({ url, title: 'Inbox - Gmail' });

    expect(result.id).toBe('gmail-home');
    expect(result.pool).toContain('Find messages that need a reply today');
  });

  it('falls back on a Gmail message page instead of assuming inbox context', () => {
    expect(suggestionsForPage({ url: `${GMAIL}#inbox/FMfcgzQx` }).id).toBe('default');
  });

  it('falls back for invalid and unrelated URLs', () => {
    expect(suggestionsForPage({ url: 'not a URL' }).id).toBe('default');
    expect(suggestionsForPage({ url: 'https://example.com/work' }).id).toBe('default');
  });

  it('has a full, distinct set of suggestions in every language', () => {
    for (const language of LANGUAGES) {
      for (const page of [{}, { url: GMAIL }]) {
        const { pool, eyebrow, description } = suggestionsForPage(page, language);
        expect(eyebrow).not.toBe('');
        expect(description).not.toBe('');
        expect(pool.length).toBeGreaterThanOrEqual(8);
        expect(new Set(pool).size).toBe(pool.length);
      }
    }
  });

  it('switches the suggestions to the chosen language', () => {
    const english = suggestionsForPage({}, 'en');
    const chinese = suggestionsForPage({}, 'zh-TW');
    expect(chinese.pool).not.toEqual(english.pool);
    expect(chinese.pool[0]).toMatch(/\p{Script=Han}/u);
    expect(suggestionsForPage({}, 'ja').pool[0]).toMatch(/[\p{Script=Hiragana}\p{Script=Han}]/u);
  });

  it('keeps Traditional Chinese suggestions out of Simplified', () => {
    const text = suggestionsForPage({}, 'zh-TW').pool.join('');
    // A few characters that differ between the two scripts.
    expect(text).not.toMatch(/[页这个们务设对说发]/);
  });
});

describe('pickSuggestions', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('picks three different suggestions from the pool', () => {
    for (let i = 0; i < 50; i += 1) {
      const picked = pickSuggestions(pool);
      expect(picked).toHaveLength(3);
      expect(new Set(picked).size).toBe(3);
      for (const item of picked) expect(pool).toContain(item);
    }
  });

  it('does not change the pool it draws from', () => {
    const copy = [...pool];
    pickSuggestions(pool);
    expect(pool).toEqual(copy);
  });

  it('follows the random source, and gives everything when the pool is small', () => {
    expect(pickSuggestions(pool, 3, () => 0)).toEqual(['a', 'b', 'c']);
    expect(pickSuggestions(pool, 3, () => 0.99)).toEqual(['f', 'e', 'd']);
    expect(pickSuggestions(['x', 'y'])).toHaveLength(2);
  });

  it('varies between draws', () => {
    const draws = new Set(Array.from({ length: 40 }, () => pickSuggestions(pool).join()));
    expect(draws.size).toBeGreaterThan(1);
  });
});
