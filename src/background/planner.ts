import { isGatedAction } from '../core/gate-policy';
import type { ActionKind, Plan, PlanStep } from '../core/types';
import { newId } from '../shared/messages';
import {
  getDefaultLlmProfile,
  isRemoteHttpOrigin,
  profileEndpoint,
  profileOrigin,
  validateLlmProfile,
  type Settings,
} from '../shared/settings';
import { LlmRequestError, requestPlan } from './llm-client';

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

const ACTIONS = new Set<ActionKind>([
  'read',
  'scroll',
  'click',
  'type',
  'navigate',
  'open_tab',
  'submit_form',
  'purchase',
  'send_message',
  'delete',
  'sign_in',
  'change_settings',
]);

const TARGET_REQUIRED = new Set<ActionKind>([
  'click',
  'type',
  'navigate',
  'open_tab',
  'submit_form',
  'purchase',
  'send_message',
  'delete',
  'sign_in',
  'change_settings',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseDraftSteps(value: unknown): DraftStep[] {
  const steps = asRecord(value)?.steps;
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 24) {
    throw new Error('The model returned a plan with an invalid number of steps.');
  }
  return steps.map((value, index) => {
    const step = asRecord(value);
    const title = optionalString(step?.title);
    const action = step?.action;
    if (!title || typeof action !== 'string' || !ACTIONS.has(action as ActionKind)) {
      throw new Error(`The model returned an invalid step at position ${index + 1}.`);
    }
    const typedAction = action as ActionKind;
    const target = optionalString(step?.target);
    const enteredValue = optionalString(step?.value);
    if (TARGET_REQUIRED.has(typedAction) && !target) {
      throw new Error(`Step ${index + 1} needs a target before Arlo can execute it.`);
    }
    if (typedAction === 'type' && !enteredValue) {
      throw new Error(`Step ${index + 1} needs text before Arlo can execute it.`);
    }
    return {
      title,
      action: typedAction,
      ...(target ? { target } : {}),
      ...(enteredValue ? { value: enteredValue } : {}),
      ...(optionalString(step?.gateDetail) ? { gateDetail: optionalString(step?.gateDetail) } : {}),
    };
  });
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

/** Creates one immutable model/profile snapshot for a task's planning request. */
export function createPlanner(settings: Settings): Planner {
  const selected = getDefaultLlmProfile(settings);
  if (!selected) {
    throw new Error('Set up a default AI connection in Settings before starting a task.');
  }
  const errors = validateLlmProfile(selected);
  if (errors.length) throw new Error(`The default AI connection is incomplete. ${errors[0]}`);

  const origin = profileOrigin(selected);
  if (selected.dataOriginAcknowledged !== origin) {
    throw new Error('Confirm the default AI connection’s data destination in Settings first.');
  }
  if (isRemoteHttpOrigin(origin) && selected.insecureOriginAcknowledged !== origin) {
    throw new Error('Confirm the default AI connection’s insecure HTTP destination first.');
  }

  const profile = {
    ...selected,
    modelIds: [...selected.modelIds],
    discovery: { ...selected.discovery },
  };
  const gatedActions = [...settings.gatedActions];
  return {
    async createPlan(prompt, page, taskId) {
      const raw = await requestPlan(profile, prompt, page);
      try {
        return toPlan(taskId, parseDraftSteps(raw), gatedActions);
      } catch (cause) {
        throw new LlmRequestError(
          cause instanceof Error ? cause.message : 'The model returned an invalid plan.',
          { endpoint: profileEndpoint(profile), apiContract: profile.apiContract },
        );
      }
    },
  };
}
