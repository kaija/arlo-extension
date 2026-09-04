import { describe, expect, it } from 'vitest';

import { ACTION_LABELS, DEFAULT_GATED_ACTIONS, isGatedAction } from '../src/core/gate-policy';
import type { ActionKind } from '../src/core/types';

describe('gate policy', () => {
  it('gates every irreversible action named in the product rules', () => {
    const irreversible: ActionKind[] = [
      'submit_form',
      'purchase',
      'send_message',
      'delete',
      'sign_in',
      'change_settings',
    ];
    for (const action of irreversible) {
      expect(isGatedAction(action)).toBe(true);
    }
  });

  it('lets ordinary browsing run without asking', () => {
    const ordinary: ActionKind[] = ['read', 'scroll', 'click', 'type', 'navigate', 'open_tab'];
    for (const action of ordinary) {
      expect(isGatedAction(action)).toBe(false);
    }
  });

  it('honours a user-narrowed gate list', () => {
    expect(isGatedAction('purchase', ['delete'])).toBe(false);
    expect(isGatedAction('delete', ['delete'])).toBe(true);
  });

  it('labels every action kind', () => {
    for (const action of [...DEFAULT_GATED_ACTIONS, 'read', 'scroll'] as ActionKind[]) {
      expect(ACTION_LABELS[action]).toBeTruthy();
    }
  });
});
