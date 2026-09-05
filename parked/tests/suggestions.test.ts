import { describe, expect, it } from 'vitest';

import { suggestionsForHost } from '../src/core/suggestions';

describe('suggestionsForHost', () => {
  it('offers shopping tasks on a shop', () => {
    const { kind, examples } = suggestionsForHost('shop.example.com');
    expect(kind).toBe('shopping');
    expect(examples[0]).toMatch(/reorder/i);
  });

  it('falls back to generic tasks on an unknown host', () => {
    expect(suggestionsForHost('example.test').kind).toBe('generic');
  });

  it('always offers between three and four examples', () => {
    for (const host of ['shop.example', 'news.example', 'apply.example', '']) {
      const { examples } = suggestionsForHost(host);
      expect(examples.length).toBeGreaterThanOrEqual(3);
      expect(examples.length).toBeLessThanOrEqual(4);
    }
  });
});
