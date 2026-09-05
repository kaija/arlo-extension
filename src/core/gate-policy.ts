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

/**
 * What a gated step will do, phrased so it can be dropped into a sentence:
 * "Waiting for your OK before it places the order".
 */
export const GATE_VERBS: Record<ActionKind, string> = {
  read: 'continues',
  scroll: 'continues',
  click: 'makes the click',
  type: 'types that in',
  navigate: 'leaves this page',
  open_tab: 'opens a tab',
  submit_form: 'submits the form',
  purchase: 'places the order',
  send_message: 'sends the message',
  delete: 'deletes it',
  sign_in: 'signs in',
  change_settings: 'changes the settings',
};

/**
 * The Gate's primary button names the consequence rather than saying "Approve",
 * so a mis-click cannot be a mis-read.
 */
export const GATE_APPROVE_LABELS: Record<ActionKind, string> = {
  read: 'Approve and continue',
  scroll: 'Approve and continue',
  click: 'Approve — make the click',
  type: 'Approve — type it in',
  navigate: 'Approve — leave this page',
  open_tab: 'Approve — open the tab',
  submit_form: 'Approve — submit the form',
  purchase: 'Approve — place the order',
  send_message: 'Approve — send the message',
  delete: 'Approve — delete it',
  sign_in: 'Approve — sign in',
  change_settings: 'Approve — change the settings',
};
