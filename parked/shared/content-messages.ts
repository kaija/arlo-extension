/*
 * PARKED — the content-script half of src/shared/messages.ts.
 *
 * Restore alongside parked/content-script/ and the sendToContent helper.
 */

/** Sent from the background to a content script in the operated tab. */
export type ContentRequest =
  | { type: 'content:ping' }
  | { type: 'content:highlight'; selector: string; label: string }
  | { type: 'content:clear-highlight' }
  | { type: 'content:click'; selector: string }
  | { type: 'content:type'; selector: string; value: string }
  | { type: 'content:scroll'; selector?: string }
  | { type: 'content:read' };

export type ContentResponse =
  | { ok: true; text?: string; title?: string; url?: string }
  | { ok: false; error: string; reason?: 'element_not_found' | 'sign_in_required' | 'captcha' };
