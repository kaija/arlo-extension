import { isGatedAction } from '../core/gate-policy';
import type { ActionKind, Plan, PlanStep } from '../core/types';
import { newId } from '../shared/messages';
import type { Settings } from '../shared/settings';

export interface PageContext {
  url: string;
  title: string;
  text: string;
}

export interface Planner {
  createPlan(prompt: string, page: PageContext, taskId: string): Promise<Plan>;
}

interface DraftStep {
  title: string;
  action: ActionKind;
  target?: string;
  value?: string;
  gateDetail?: string;
}

function toPlan(taskId: string, drafts: DraftStep[], gatedActions: ActionKind[]): Plan {
  const steps: PlanStep[] = drafts.map((draft) => ({
    id: newId('step'),
    title: draft.title,
    action: draft.action,
    ...(draft.target !== undefined ? { target: draft.target } : {}),
    ...(draft.value !== undefined ? { value: draft.value } : {}),
    ...(draft.gateDetail !== undefined ? { gateDetail: draft.gateDetail } : {}),
    requiresApproval: isGatedAction(draft.action, gatedActions),
    status: 'pending' as const,
  }));
  return { id: newId('plan'), taskId, steps };
}

/**
 * A deterministic planner used until a model-backed one is wired in. It returns
 * the reorder scenario from the design doc so the whole approve → run → gate →
 * done path is exercisable without an API key.
 */
export function createDemoPlanner(gatedActions: ActionKind[]): Planner {
  return {
    async createPlan(prompt, page, taskId) {
      const drafts: DraftStep[] = [
        { title: 'Open your order history', action: 'navigate', target: '/orders' },
        {
          title: 'Find the coffee beans ordered last month',
          action: 'read',
          target: 'main',
        },
        { title: 'Check the current price is under $25', action: 'read', target: 'main' },
        { title: 'Add the item to your cart', action: 'click', target: '[data-add-to-cart]' },
        { title: 'Go to checkout', action: 'click', target: '[data-checkout]' },
        {
          title: 'Place the order',
          action: 'purchase',
          target: '[data-place-order]',
          gateDetail: 'This charges your saved payment method and cannot be undone.',
        },
        { title: 'Report the order number back to you', action: 'read', target: 'main' },
      ];
      void prompt;
      void page;
      return toPlan(taskId, drafts, gatedActions);
    },
  };
}

/**
 * Seam for the real planner. Point this at the model once the API client lands:
 * it receives the user's prompt plus the current page context and must return a
 * plan whose irreversible steps are already flagged (`requiresApproval`), so the
 * user sees the Gate in the plan rather than being surprised mid-run.
 */
export function createPlanner(settings: Settings): Planner {
  return createDemoPlanner(settings.gatedActions);
}
