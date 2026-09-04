import type { ContentRequest, ContentResponse } from '../shared/messages';
import { clearHighlight, highlight } from './highlight';

declare global {
  interface Window {
    __arloContentLoaded?: boolean;
  }
}

// Registered content scripts and programmatic injection can both fire.
if (!window.__arloContentLoaded) {
  window.__arloContentLoaded = true;
  chrome.runtime.onMessage.addListener(
    (request: ContentRequest, _sender, sendResponse: (response: ContentResponse) => void) => {
      handle(request).then(sendResponse);
      return true;
    },
  );
}

const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  '.g-recaptcha',
  '.h-captcha',
  '.cf-turnstile',
];

/**
 * When Arlo cannot find its target, the reason matters more than the failure:
 * a CAPTCHA or a sign-in wall means the user has to take over, and Arlo never
 * solves either of those itself.
 */
function diagnose(): 'captcha' | 'sign_in_required' | 'element_not_found' {
  if (CAPTCHA_SELECTORS.some((selector) => document.querySelector(selector))) return 'captcha';
  if (document.querySelector('input[type="password"]')) return 'sign_in_required';
  return 'element_not_found';
}

function notFound(selector: string): ContentResponse {
  const reason = diagnose();
  const message =
    reason === 'captcha'
      ? 'A CAPTCHA is blocking this page. Arlo does not solve CAPTCHAs.'
      : reason === 'sign_in_required'
        ? 'This page needs you to sign in. Arlo never enters credentials.'
        : `Could not find the element for "${selector}" on this page.`;
  return { ok: false, error: message, reason };
}

function find(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function isEditable(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

function selectorFor(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
  const name = element.getAttribute('name');
  if (name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;

  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body && parts.length < 4) {
    const tag = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? [...current.parentElement.children].filter(
          (sibling) => sibling.tagName === current?.tagName,
        )
      : [];
    const position = siblings.indexOf(current) + 1;
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${position})` : tag);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function interactiveElements(): string {
  const elements = [
    ...document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [contenteditable="true"]',
    ),
  ].slice(0, 80);
  return elements
    .map((element) => {
      const html = element as HTMLElement;
      const inputType = element instanceof HTMLInputElement ? ` type=${element.type}` : '';
      const label =
        element.getAttribute('aria-label') ??
        element.getAttribute('placeholder') ??
        element.getAttribute('title') ??
        (element instanceof HTMLInputElement ? element.name : html.innerText) ??
        '';
      const description = label.replace(/\s+/g, ' ').trim().slice(0, 120);
      return `${selectorFor(element)} | ${element.tagName.toLowerCase()}${inputType}${description ? ` | ${description}` : ''}`;
    })
    .join('\n');
}

async function handle(request: ContentRequest): Promise<ContentResponse> {
  switch (request.type) {
    case 'content:ping':
      return { ok: true };

    case 'content:read': {
      const visibleText = (document.body?.innerText ?? '').slice(0, 8000);
      const controls = interactiveElements().slice(0, 5000);
      return {
        ok: true,
        title: document.title,
        url: location.href,
        text: `${visibleText}\n\nInteractive elements (selector | type | label):\n${controls}`,
      };
    }

    case 'content:highlight': {
      const element = find(request.selector);
      if (!element) return notFound(request.selector);
      highlight(element, request.label);
      return { ok: true };
    }

    case 'content:clear-highlight':
      clearHighlight();
      return { ok: true };

    case 'content:click': {
      const element = find(request.selector);
      if (!element) return notFound(request.selector);
      (element as HTMLElement).click();
      return { ok: true };
    }

    case 'content:type': {
      const element = find(request.selector);
      if (!element || !isEditable(element)) return notFound(request.selector);
      element.focus();
      element.value = request.value;
      // React and friends listen for these rather than the value assignment.
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    }

    case 'content:scroll': {
      if (!request.selector) {
        window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        return { ok: true };
      }
      const element = find(request.selector);
      if (!element) return notFound(request.selector);
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return { ok: true };
    }
  }
}
