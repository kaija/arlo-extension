import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { capturePage, convertPage, readCurrentTab } from '../src/sidepanel/page-reader';
import { parseTabReadOptions, TAB_READ_MAX_CHARS } from '../src/shared/tab-read';

beforeEach(() => {
  document.head.innerHTML = '<title>Example page</title>';
  document.body.innerHTML = `
    <main id="story"><h1>Current page</h1><p>Hello <strong>reader</strong>. <a href="/guide">Guide</a></p>
    <ul><li>First item</li><li>Second item</li></ul>
    <table class="layout"><tr><th>Product</th><th>Price</th></tr><tr><td>Book</td><td>12</td></tr></table>
    <img src="/cover.png" alt="Book cover">
    <label for="search">Search</label><input id="search" name="q" value="initial" placeholder="Find">
    <button id="go" class="primary" style="color:red" onclick="bad()" aria-label="Search now">Go</button>
    <select id="size"><option value="s" selected>Small</option><option value="l">Large</option></select>
    <textarea id="note"></textarea><input type="password" value="secret">
    <input type="hidden" value="hidden-token"><div hidden>Hidden text</div>
    <div style="display:none">CSS hidden text</div><script>window.bad = 'script text';</script></main>`;
  (document.querySelector('#search') as HTMLInputElement).value = 'live query';
  (document.querySelector('#size') as HTMLSelectElement).value = 'l';
  (document.querySelector('#note') as HTMLTextAreaElement).value = 'A live note';
});

afterEach(() => vi.unstubAllGlobals());

function text(level: 'compact' | 'detailed' | 'html') {
  const captured = capturePage(undefined, level);
  if (captured.error) throw new Error(captured.error.message);
  return convertPage(captured.html, level, 'https://example.com/page');
}

describe('page reading levels', () => {
  it('keeps readable Markdown with absolute links and omits HTML, scripts and hidden content', () => {
    const result = text('compact');
    expect(result).toContain('# Current page');
    expect(result).toContain('**reader**');
    expect(result).toContain('[Guide](https://example.com/guide)');
    expect(result).toMatch(/-\s+First item/);
    expect(result).toContain('Book | 12');
    expect(result).not.toMatch(
      /<input|<button|<table|script text|Hidden text|CSS hidden text|hidden-token|secret/,
    );
    expect(result).not.toContain('https://example.com/cover.png');
  });

  it('retains detailed tables, images and sanitized interactive HTML with live form state', () => {
    const result = text('detailed');
    expect(result).toContain('<table>');
    expect(result).toContain('<th>Product</th>');
    expect(result).toContain('![Book cover](https://example.com/cover.png)');
    expect(result).toContain('value="live query"');
    expect(result).toContain('aria-label="Search now"');
    expect(result).toMatch(/<option value="l" selected="">Large<\/option>/);
    expect(result).toContain('<textarea id="note">A live note</textarea>');
    expect(result).toContain('value="[redacted]"');
    expect(result).not.toMatch(/class=|onclick=|style=|hidden-token|script text|secret/);
  });

  it('preserves blank controls, custom roles and table spans', () => {
    const result = convertPage(
      '<button aria-label="Close"></button><textarea></textarea><div role="checkbox" aria-checked="true"></div><table><tr><td colspan="2">Merged</td></tr></table>',
      'detailed',
      'https://example.com',
    );
    expect(result).toContain('<button aria-label="Close"></button>');
    expect(result).toContain('<textarea></textarea>');
    expect(result).toContain('aria-checked="true"');
    expect(result).toContain('colspan="2"');
  });

  it('returns the exact serialized DOM in HTML mode without modifying the live page', () => {
    const before = document.documentElement.outerHTML;
    text('compact');
    text('detailed');
    const html = text('html');
    expect(html).toBe(`${new XMLSerializer().serializeToString(document.doctype!)}\n${before}`);
    expect(html).toContain('<title>Example page</title>');
    expect(html).toContain('window.bad');
    expect(html).toContain('hidden-token');
    expect(document.documentElement.outerHTML).toBe(before);
    expect((document.querySelector('#search') as HTMLInputElement).value).toBe('live query');
  });

  it('narrows the read and reports invalid and missing selectors', () => {
    expect(capturePage('h1', 'html').html).toBe('<h1>Current page</h1>');
    expect(capturePage('[', 'compact').error?.code).toBe('INVALID_SELECTOR');
    expect(capturePage('#missing', 'html').error?.code).toBe('NOT_FOUND');
  });

  it('strips unsafe URLs even inside preserved HTML', () => {
    const result = convertPage(
      '<button><a href="javascript:bad()">Click</a><img src="data:text/html,bad" onerror="bad()"></button>',
      'detailed',
      'https://example.com',
    );
    expect(result).not.toMatch(/javascript:|data:|onerror/);
  });

  it('captures a document base URL for relative links', () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<base href="https://cdn.example.com/articles/">',
    );
    const captured = capturePage(undefined, 'compact');
    if (captured.error) throw new Error(captured.error.message);
    expect(captured.baseUrl).toBe('https://cdn.example.com/articles/');
    expect(convertPage(captured.html, 'compact', captured.baseUrl)).toContain(
      '[Guide](https://cdn.example.com/guide)',
    );
  });
});

describe('current tab and continuation', () => {
  function browser() {
    const query = vi.fn().mockResolvedValue([{ id: 42, url: 'https://example.com/page' }]);
    const executeScript = vi.fn().mockImplementation(async () => [
      {
        result: {
          ...capturePage(undefined, 'compact'),
          url: 'https://example.com/page',
          baseUrl: 'https://example.com/page',
        },
      },
    ]);
    vi.stubGlobal('chrome', { tabs: { query }, scripting: { executeScript } });
    vi.stubGlobal('crypto', webcrypto);
    return { query, executeScript };
  }

  it('resolves the active tab on every call in the panel window and uses the isolated main frame', async () => {
    const { query, executeScript } = browser();
    await readCurrentTab(7, {});
    query.mockResolvedValueOnce([{ id: 43, url: 'https://example.com/next' }]);
    await readCurrentTab(7, {});
    expect(query.mock.calls).toEqual([
      [{ active: true, windowId: 7 }],
      [{ active: true, windowId: 7 }],
    ]);
    expect(executeScript.mock.calls[0]?.[0]).toMatchObject({
      target: { tabId: 42, frameIds: [0] },
      world: 'ISOLATED',
    });
    expect(executeScript.mock.calls[1]?.[0]).toMatchObject({ target: { tabId: 43 } });
  });

  it('returns all content across bounded chunks and rejects page or tab changes', async () => {
    const { query } = browser();
    const first = await readCurrentTab(7, { maxChars: 12 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const rest = await readCurrentTab(7, {
      offset: first.page.nextOffset,
      snapshotId: first.page.snapshotId,
    });
    expect(rest.ok).toBe(true);
    if (!rest.ok) return;
    expect(first.page.content + rest.page.content).toBe(text('compact'));
    expect(rest.page.nextOffset).toBeNull();
    query.mockResolvedValueOnce([{ id: 99, url: 'https://example.com/page' }]);
    expect(await readCurrentTab(7, { snapshotId: first.page.snapshotId })).toMatchObject({
      ok: false,
      error: { code: 'PAGE_CHANGED' },
    });
    document.querySelector('h1')!.textContent = 'Updated page';
    expect(await readCurrentTab(7, { snapshotId: first.page.snapshotId })).toMatchObject({
      ok: false,
      error: { code: 'PAGE_CHANGED' },
    });
  });

  it('reports permissions, absent tabs, unsupported pages and out-of-range offsets', async () => {
    const { query, executeScript } = browser();
    executeScript.mockRejectedValueOnce(new Error('Cannot access contents of url'));
    expect(await readCurrentTab(7, {})).toMatchObject({
      ok: false,
      error: { code: 'PAGE_ACCESS_REQUIRED' },
    });
    query.mockResolvedValueOnce([]);
    expect(await readCurrentTab(7, {})).toMatchObject({
      ok: false,
      error: { code: 'NO_ACTIVE_TAB' },
    });
    query.mockResolvedValueOnce([{ id: 1, url: 'chrome://extensions' }]);
    expect(await readCurrentTab(7, {})).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED_PAGE' },
    });
    query.mockRejectedValueOnce(new Error('Browser unavailable'));
    expect(await readCurrentTab(7, {})).toMatchObject({
      ok: false,
      error: { code: 'READ_FAILED', message: 'Browser unavailable' },
    });
    query.mockRejectedValueOnce('Browser disconnected');
    expect(await readCurrentTab(7, {})).toMatchObject({
      ok: false,
      error: { code: 'READ_FAILED', message: 'Browser disconnected' },
    });
    const first = await readCurrentTab(7, {});
    if (!first.ok) throw new Error('Expected a page read');
    expect(
      await readCurrentTab(7, {
        offset: first.page.totalChars + 1,
        snapshotId: first.page.snapshotId,
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } });
  });

  it.each([
    ['Cannot access contents of url "https://example.com/".', 'PAGE_ACCESS_REQUIRED'],
    ['Cannot access a chrome:// URL', 'UNSUPPORTED_PAGE'],
    ['The extensions gallery cannot be scripted.', 'UNSUPPORTED_PAGE'],
    ['No tab with id: 42.', 'NO_ACTIVE_TAB'],
    ['Frame with ID 0 was removed.', 'READ_FAILED'],
    ['Unexpected serialization failure', 'READ_FAILED'],
  ])('preserves the Chrome error and classifies %s as %s', async (message, code) => {
    const { executeScript } = browser();
    executeScript.mockRejectedValueOnce(new Error(message));
    const result = await readCurrentTab(7, {});
    expect(result).toMatchObject({
      ok: false,
      error: { code, message: expect.stringContaining(message) },
    });
  });

  it('identifies a missing scripting API instead of requesting page access', async () => {
    browser();
    vi.stubGlobal('chrome', { tabs: chrome.tabs });
    expect(await readCurrentTab(7, {})).toMatchObject({
      ok: false,
      error: { code: 'READER_UNAVAILABLE' },
    });
  });
});

describe('read options', () => {
  it('defaults to compact and rejects malformed or unbounded requests', () => {
    expect(parseTabReadOptions()).toEqual({ level: 'compact', offset: 0, maxChars: 12000 });
    for (const value of [
      null,
      [],
      { tabId: 1 },
      { level: 'full' },
      { offset: -1 },
      { offset: '0' },
      { offset: 1 },
      { maxChars: TAB_READ_MAX_CHARS + 1 },
      { maxChars: 0 },
      { maxChars: 1.5 },
      { selector: '' },
      { selector: 'a'.repeat(1001) },
      { snapshotId: 'bad' },
    ]) {
      expect(() => parseTabReadOptions(value)).toThrow();
    }
  });
});
