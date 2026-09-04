import type { NeedsHelpReason, Plan, PlanStep, RunState, StepStatus, Task } from './types';

export const initialRunState: RunState = {
  phase: 'idle',
  task: null,
  plan: null,
  currentStepIndex: -1,
  needsHelp: null,
  summary: null,
  startedAt: null,
  endedAt: null,
};

export type RunEvent =
  | { type: 'TASK_SUBMITTED'; task: Task }
  | { type: 'PLAN_READY'; plan: Plan }
  | { type: 'PLAN_APPROVED'; at: number }
  | { type: 'PLAN_CANCELLED' }
  | { type: 'STEP_STARTED'; index: number }
  | { type: 'STEP_SUCCEEDED'; index: number; result?: string }
  | { type: 'STEP_FAILED'; index: number; reason: NeedsHelpReason; message: string }
  | { type: 'GATE_REACHED'; index: number }
  | { type: 'GATE_APPROVED' }
  | { type: 'GATE_SKIPPED' }
  | { type: 'HELP_RESOLVED' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP'; at: number }
  | { type: 'RUN_COMPLETED'; summary: string; at: number }
  | { type: 'RESET' };

/** Phases in which Arlo is holding the ball and the user can Pause or Stop. */
const ACTIVE_PHASES = new Set(['planning', 'running', 'paused', 'gated', 'needs_help']);

export function isActive(state: RunState): boolean {
  return ACTIVE_PHASES.has(state.phase);
}

export function canPause(state: RunState): boolean {
  return state.phase === 'running';
}

export function canStop(state: RunState): boolean {
  return isActive(state);
}

export function currentStep(state: RunState): PlanStep | null {
  if (!state.plan) return null;
  return state.plan.steps[state.currentStepIndex] ?? null;
}

/** "Step 4 of 7" — the one-line progress used on the collapsed Run card. */
export function progressLabel(state: RunState): string | null {
  if (!state.plan) return null;
  const total = state.plan.steps.length;
  const position = Math.min(Math.max(state.currentStepIndex + 1, 1), total);
  return `Step ${position} of ${total}`;
}

function withStep(state: RunState, index: number, patch: Partial<PlanStep>): RunState {
  if (!state.plan) return state;
  const steps = state.plan.steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
  return { ...state, plan: { ...state.plan, steps } };
}

function markRemaining(state: RunState, from: number, status: StepStatus): RunState {
  if (!state.plan) return state;
  const steps = state.plan.steps.map((step, i) =>
    i >= from && (step.status === 'pending' || step.status === 'running')
      ? { ...step, status }
      : step,
  );
  return { ...state, plan: { ...state.plan, steps } };
}

/**
 * The state machine from the design doc, as a pure reducer:
 *
 *   idle → planning → awaiting_approval → running ⇄ gated
 *                                            ├→ needs_help → running
 *                                            ├→ paused → running
 *                                            ├→ stopped
 *                                            └→ done
 *
 * Events that do not apply to the current phase are ignored, so a late message
 * from a stopped run can never restart it.
 */
export function reduce(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case 'TASK_SUBMITTED':
      if (isActive(state)) return state;
      return { ...initialRunState, phase: 'planning', task: event.task };

    case 'PLAN_READY':
      if (state.phase !== 'planning') return state;
      return { ...state, phase: 'awaiting_approval', plan: event.plan, currentStepIndex: -1 };

    case 'PLAN_APPROVED':
      if (state.phase !== 'awaiting_approval') return state;
      return { ...state, phase: 'running', startedAt: event.at, currentStepIndex: 0 };

    case 'PLAN_CANCELLED':
      if (state.phase !== 'awaiting_approval' && state.phase !== 'planning') return state;
      return { ...initialRunState };

    case 'STEP_STARTED':
      if (state.phase !== 'running') return state;
      return withStep({ ...state, currentStepIndex: event.index }, event.index, {
        status: 'running',
      });

    case 'STEP_SUCCEEDED': {
      if (state.phase !== 'running') return state;
      const patch: Partial<PlanStep> = { status: 'done' };
      if (event.result !== undefined) patch.result = event.result;
      return withStep(state, event.index, patch);
    }

    case 'STEP_FAILED':
      if (state.phase !== 'running') return state;
      return {
        ...withStep(state, event.index, { status: 'failed', error: event.message }),
        phase: 'needs_help',
        currentStepIndex: event.index,
        needsHelp: { reason: event.reason, message: event.message, stepIndex: event.index },
      };

    case 'GATE_REACHED':
      if (state.phase !== 'running') return state;
      return { ...state, phase: 'gated', currentStepIndex: event.index };

    case 'GATE_APPROVED':
      if (state.phase !== 'gated') return state;
      return { ...state, phase: 'running' };

    case 'GATE_SKIPPED': {
      if (state.phase !== 'gated') return state;
      const skipped = withStep(state, state.currentStepIndex, { status: 'skipped' });
      return { ...skipped, phase: 'running' };
    }

    case 'HELP_RESOLVED': {
      if (state.phase !== 'needs_help') return state;
      const retried = withStep(state, state.currentStepIndex, {
        status: 'pending',
        error: undefined,
      });
      return { ...retried, phase: 'running', needsHelp: null };
    }

    case 'PAUSE':
      if (!canPause(state)) return state;
      return { ...state, phase: 'paused' };

    case 'RESUME':
      if (state.phase !== 'paused') return state;
      return { ...state, phase: 'running' };

    case 'STOP': {
      // Stopping keeps the plan so the user can still see what was done.
      if (!canStop(state)) return state;
      const cleared = markRemaining(state, 0, 'skipped');
      return { ...cleared, phase: 'stopped', needsHelp: null, endedAt: event.at };
    }

    case 'RUN_COMPLETED':
      if (state.phase !== 'running') return state;
      return { ...state, phase: 'done', summary: event.summary, endedAt: event.at };

    case 'RESET':
      return { ...initialRunState };

    default:
      return state;
  }
}
