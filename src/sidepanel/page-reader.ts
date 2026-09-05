import TurndownService from 'turndown';

import {
  parseTabReadOptions,
  TabReadError,
  tabReadFailure,
  type TabReadLevel,
  type TabReadResult,
} from '../shared/tab-read';

/** This function is serialized by Chrome. All runtime dependencies stay inside it. */
export function capturePage(selector: string | undefined, level: TabReadLevel) {
  let source: Element | null;
  try {
    source = selector
      ? document.querySelector(selector)
      : level === 'html'
        ? document.documentElement
        : document.body;
  } catch {
    return { error: { code: 'INVALID_SELECTOR', message: 'The CSS selector is invalid.' } };
  }
  if (!source)
    return { error: { code: 'NOT_FOUND', message: 'No page element matches this selector.' } };
  const clone = source.cloneNode(true) as Element;
  if (level !== 'html') {
    // Pair originals and copies before pruning: never change the actual webpage.
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    for (let i = 0; i < originals.length; i++) {
      const original = originals[i]!;
      const copy = copies[i]!;
      if (copy !== clone && !clone.contains(copy)) continue;
      const style = getComputedStyle(original);
      if (
        original.matches(
          'script,style,noscript,template,svg,canvas,iframe,[hidden],[aria-hidden="true"],input[type="hidden"]',
        ) ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse'
      ) {
        if (copy === clone) clone.replaceChildren();
        else copy.remove();
        continue;
      }
      if (original instanceof HTMLInputElement) {
        copy.setAttribute('value', original.type === 'password' ? '[redacted]' : original.value);
        copy.toggleAttribute('checked', original.checked);
      } else if (original instanceof HTMLTextAreaElement) {
        copy.textContent = original.value;
      } else if (original instanceof HTMLOptionElement) {
        copy.toggleAttribute('selected', original.selected);
      }
    }
  }
  const doctype =
    level === 'html' && !selector && document.doctype
      ? `${new XMLSerializer().serializeToString(document.doctype)}\n`
      : '';
  const html = doctype + clone.outerHTML;
  if (html.length > 5_000_000) {
    return {
      error: {
        code: 'PAGE_TOO_LARGE',
        message:
          'This page exceeds 5 million HTML characters. Read a smaller region with selector.',
      },
    };
  }
  return {
    html,
    url: location.href,
    baseUrl: document.baseURI,
    title: document.title,
    capturedAt: new Date().toISOString(),
  };
}

const KEPT_TAGS = new Set([
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'button',
  'input',
  'select',
  'option',
  'optgroup',
  'textarea',
  'label',
  'details',
  'summary',
]);
const KEPT_ATTRIBUTES = new Set([
  'id',
  'name',
  'type',
  'value',
  'role',
  'title',
  'placeholder',
  'for',
  'disabled',
  'checked',
  'selected',
  'multiple',
  'required',
  'readonly',
  'min',
  'max',
  'step',
  'colspan',
  'rowspan',
  'scope',
  'open',
  'href',
  'src',
  'alt',
  'label',
  'contenteditable',
  'tabindex',
]);

/** Converts inert markup only. Page content is never mounted into the panel UI. */
export function convertPage(html: string, level: TabReadLevel, url: string): string {
  if (level === 'html') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll(
      'script,style,noscript,template,svg,canvas,iframe,[hidden],[aria-hidden="true"],input[type="hidden"]',
    )
    .forEach((node) => node.remove());
  for (const element of doc.body.querySelectorAll('*')) {
    for (const attr of [...element.attributes]) {
      if (!KEPT_ATTRIBUTES.has(attr.name) && !attr.name.startsWith('aria-'))
        element.removeAttribute(attr.name);
    }
    for (const attr of ['href', 'src']) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      try {
        const resolved = new URL(value, url);
        if (['http:', 'https:', 'mailto:', 'tel:'].includes(resolved.protocol))
          element.setAttribute(attr, resolved.href);
        else element.removeAttribute(attr);
      } catch {
        element.removeAttribute(attr);
      }
    }
    if (element.matches('input[type="password"]')) element.setAttribute('value', '[redacted]');
  }
  const preserve = (node: HTMLElement) =>
    level === 'detailed' &&
    (KEPT_TAGS.has(node.nodeName.toLowerCase()) ||
      node.hasAttribute('role') ||
      node.hasAttribute('contenteditable'));
  const raw = (node: HTMLElement) => `\n\n${node.outerHTML}\n\n`;
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    // Turndown's blank rule precedes even custom rules (e.g. an empty textarea).
    blankReplacement: (_content, node) =>
      preserve(node as HTMLElement) ? raw(node as HTMLElement) : '',
  });
  turndown.addRule('page-details', {
    filter: (node) => preserve(node),
    replacement: (_content, node) => raw(node as HTMLElement),
  });
  if (level === 'compact') {
    turndown.addRule('image-description', {
      filter: 'img',
      replacement: (_content, node) => (node as HTMLElement).getAttribute('alt') ?? '',
    });
    turndown.addRule('table-row-text', {
      filter: 'tr',
      replacement: (content) => `\n${content.trim()}\n`,
    });
    turndown.addRule('table-cell-text', {
      filter: ['td', 'th'],
      replacement: (content) => `${content.trim()} | `,
    });
  }
  return turndown.turndown(doc.body);
}

/** Bind to the panel's window once, then resolve its active tab afresh per call. */
export async function readCurrentTab(windowId: number, input: unknown): Promise<TabReadResult> {
  try {
    const options = parseTabReadOptions(input);
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab?.id === undefined)
      throw new TabReadError('NO_ACTIVE_TAB', 'There is no active tab in the Arlo window.');
    if (tab.url && !/^https?:\/\//.test(tab.url)) {
      throw new TabReadError(
        'UNSUPPORTED_PAGE',
        'Chrome internal pages, extension pages, and local files cannot be read by this tool.',
      );
    }
    if (!chrome.scripting?.executeScript) {
      throw new TabReadError(
        'READER_UNAVAILABLE',
        'Chrome scripting is unavailable in this Arlo panel. Reload Arlo at chrome://extensions to load its scripting permission, then reopen the panel.',
      );
    }
    let capture: chrome.scripting.InjectionResult<ReturnType<typeof capturePage>>[];
    try {
      capture = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: 'ISOLATED',
        func: capturePage,
        args: [options.selector ?? '', options.level],
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const context = `Chrome failed to read tab ${tab.id} in Arlo window ${windowId}: ${message}`;
      if (
        /Cannot access (?:a )?(?:chrome|chrome-extension|file):\/\/|extensions gallery cannot be scripted/i.test(
          message,
        )
      )
        throw new TabReadError('UNSUPPORTED_PAGE', context);
      if (/No tab with id|Invalid tab ID/i.test(message))
        throw new TabReadError('NO_ACTIVE_TAB', context);
      if (
        /Cannot access contents of|must request permission to access|Missing host permission/i.test(
          message,
        )
      ) {
        throw new TabReadError(
          'PAGE_ACCESS_REQUIRED',
          `${context} Click the Arlo toolbar icon on the active webpage to grant page access, then retry. If you already did, report this Chrome error instead of repeating the same instruction.`,
        );
      }
      throw new TabReadError('READ_FAILED', context);
    }
    const result = capture[0]?.result;
    if (!result)
      throw new TabReadError(
        'READ_FAILED',
        'The page returned no content. It may have navigated or closed.',
      );
    if (result.error) throw new TabReadError(result.error.code, result.error.message);
    const content = convertPage(result.html, options.level, result.baseUrl);
    const fingerprint = JSON.stringify([
      tab.id,
      result.url,
      options.level,
      options.selector ?? '',
      content,
    ]);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    const snapshotId = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    if (options.snapshotId && options.snapshotId !== snapshotId) {
      throw new TabReadError(
        'PAGE_CHANGED',
        'The active tab or its content changed. Start a new read at offset 0 without snapshotId.',
      );
    }
    if (options.offset > content.length)
      throw new TabReadError('INVALID_ARGUMENT', 'offset exceeds the page content length.');
    const end = Math.min(content.length, options.offset + options.maxChars);
    return {
      ok: true,
      page: {
        tabId: tab.id,
        url: result.url,
        title: result.title,
        capturedAt: result.capturedAt,
        level: options.level,
        scope: 'main-frame',
        content: content.slice(options.offset, end),
        totalChars: content.length,
        offset: options.offset,
        nextOffset: end < content.length ? end : null,
        snapshotId,
      },
    };
  } catch (cause) {
    return tabReadFailure(cause);
  }
}
