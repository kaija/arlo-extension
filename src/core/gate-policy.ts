import type { ActionKind } from './types';

/**
 * Actions that are irreversible from the user's point of view. Hitting one of
 * these stops the run and asks (a Gate). Everything else — reading, scrolling,
 * following links, searching, filtering, opening tabs — just runs.
 *
 * The user can widen this list in Settings, so treat it as the default only.
 */
export const DEFAULT_GATED_ACTIONS: ActionKind[] = [
  'submit_form',
  'purchase',
  'send_message',
  'delete',
  'sign_in',
  'change_settings',
];

export function isGatedAction(
  action: ActionKind,
  gatedActions: readonly ActionKind[] = DEFAULT_GATED_ACTIONS,
): boolean {
  return gatedActions.includes(action);
}

/** Human-readable label for an action, used in plan rows and Gate screens. */
export const ACTION_LABELS: Record<ActionKind, string> = {
  read: 'Read page',
  scroll: 'Scroll',
  click: 'Click',
  type: 'Type',
  navigate: 'Go to page',
  open_tab: 'Open tab',
  submit_form: 'Submit form',
  purchase: 'Place order',
  send_message: 'Send message',
  delete: 'Delete data',
  sign_in: 'Sign in',
  change_settings: 'Change account settings',
};
