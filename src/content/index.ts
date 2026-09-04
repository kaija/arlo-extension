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

async function handle(request: ContentRequest): Promise<ContentResponse> {
  switch (request.type) {
    case 'content:ping':
      return { ok: true };

    case 'content:read':
      return {
        ok: true,
        title: document.title,
        url: location.href,
        text: (document.body?.innerText ?? '').slice(0, 8000),
      };

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
