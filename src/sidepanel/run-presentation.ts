/**
 * Turns a RunState into the strings and tones the run card shows. Kept apart
 * from the components so the wording of a run — the part a user actually reads
 * to decide whether to intervene — can be tested on its own.
 */
import { GATE_VERBS } from '../core/gate-policy';
import type { RunState } from '../core/types';

/** The step-row states the design draws. */
export type StepTone = 'pending' | 'running' | 'gate' | 'done' | 'skipped' | 'held' | 'failed';

/** The colour family the whole run card takes. */
export type RunTone = 'accent' | 'warning' | 'success' | 'danger';

const STEP_MARKS: Record<Exclude<StepTone, 'pending' | 'running'>, string> = {
  gate: '!',
  done: '✓',
  skipped: '–',
  held: '·',
  failed: '✕',
};

export function stepTone(state: RunState, index: number): StepTone {
  const step = state.plan?.steps[index];
  if (!step) return 'pending';
  if (step.status === 'done') return 'done';
  if (step.status === 'failed') return 'failed';
  if (step.status === 'skipped') return 'skipped';

  if (index !== state.currentStepIndex) return 'pending';
  if (state.phase === 'gated') return 'gate';
  if (state.phase === 'running' && step.status === 'running') return 'running';
  if (state.phase === 'paused' || state.phase === 'stopped') return 'held';
  return 'pending';
}

/** The glyph inside the step dot. Running is empty — the dot itself spins. */
export function stepMark(tone: StepTone, index: number): string {
  if (tone === 'pending') return String(index + 1);
  if (tone === 'running') return '';
  return STEP_MARKS[tone];
}

export function runTone(state: RunState): RunTone {
  switch (state.phase) {
    case 'gated':
    case 'needs_help':
      return 'warning';
    case 'done':
      return 'success';
    case 'stopped':
    case 'failed':
      return 'danger';
    default:
      return 'accent';
  }
}

const TONE_COLORS: Record<RunTone, string> = {
  accent: 'var(--color-accent)',
  warning: 'var(--color-warning)',
  success: 'var(--color-success)',
  danger: 'var(--color-danger)',
};

export function runToneColor(state: RunState): string {
  return TONE_COLORS[runTone(state)];
}

function total(state: RunState): number {
  return state.plan?.steps.length ?? 0;
}

/** How far through the plan the run is, as whole finished steps. */
export function finishedSteps(state: RunState): number {
  const steps = state.plan?.steps ?? [];
  return steps.filter((step) => step.status === 'done' || step.status === 'skipped').length;
}

export function runPercent(state: RunState): number {
  const steps = total(state);
  if (steps === 0) return 0;
  if (state.phase === 'done') return 100;
  return Math.round((finishedSteps(state) / steps) * 100);
}

/** "Step 4 of 7" while it runs; where it landed once it has stopped. */
export function runCountLabel(state: RunState): string {
  const steps = total(state);
  if (steps === 0) return '';
  const position = Math.min(Math.max(state.currentStepIndex + 1, 1), steps);
  if (state.phase === 'done') return `${steps} of ${steps}`;
  if (state.phase === 'stopped') return `stopped at ${position} of ${steps}`;
  if (state.phase === 'failed') return `failed at ${position} of ${steps}`;
  return `Step ${position} of ${steps}`;
}

/** "2m 14s" — how long the run took, for the finished one-liner. */
export function elapsedLabel(state: RunState): string | null {
  if (state.startedAt == null || state.endedAt == null) return null;
  const seconds = Math.max(0, Math.round((state.endedAt - state.startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * The one line the collapsed card shows. This is the whole point of collapsing:
 * it has to say what is happening without the step list.
 *
 * A finished run keeps this short on purpose — the summary itself is printed
 * once, below the card, and repeating it here would say the same thing twice.
 */
export function runLine(state: RunState): string {
  const step = state.plan?.steps[state.currentStepIndex];

  switch (state.phase) {
    case 'done': {
      const elapsed = elapsedLabel(state);
      return elapsed ? `Done · ${elapsed}` : 'Done';
    }
    case 'stopped':
      return 'Stopped by you — nothing further was submitted';
    case 'failed':
      return 'Arlo could not finish this run';
    case 'gated':
      return step
        ? `Waiting for your OK before it ${GATE_VERBS[step.action]}`
        : 'Waiting for your OK';
    case 'needs_help':
      return state.needsHelp?.message ?? 'Arlo needs you on the page';
    case 'paused':
      return 'Paused by you — nothing running';
    default:
      return step?.title ?? 'Working…';
  }
}
