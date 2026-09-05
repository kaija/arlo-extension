import { beforeEach, describe, expect, it } from 'vitest';

import { isGatedAction } from '../src/core/gate-policy';
import {
  canPause,
  canStop,
  currentStep,
  initialRunState,
  progressLabel,
  reduce,
  type RunEvent,
} from '../src/core/run-machine';
import type { Plan, RunState, Task } from '../src/core/types';

const task: Task = {
  id: 'task_1',
  prompt: 'Reorder the coffee beans I bought last month, but only if they are still under $25.',
  createdAt: 0,
  tabId: 1,
  url: 'https://shop.example/orders',
  title: 'Orders',
};

function makePlan(): Plan {
  const drafts = [
    { title: 'Open your order history', action: 'navigate' as const },
    { title: 'Find the beans', action: 'read' as const },
    { title: 'Add to cart', action: 'click' as const },
    { title: 'Place the order', action: 'purchase' as const },
  ];
  return {
    id: 'plan_1',
    taskId: task.id,
    steps: drafts.map((draft, index) => ({
      id: `step_${index}`,
      title: draft.title,
      action: draft.action,
      requiresApproval: isGatedAction(draft.action),
      status: 'pending' as const,
    })),
  };
}

function run(events: RunEvent[], from: RunState = initialRunState): RunState {
  return events.reduce(reduce, from);
}

const approved: RunEvent[] = [
  { type: 'TASK_SUBMITTED', task },
  { type: 'PLAN_READY', plan: makePlan() },
  { type: 'PLAN_APPROVED', at: 100 },
];

describe('run machine', () => {
  let plan: Plan;
  beforeEach(() => {
    plan = makePlan();
  });

  it('walks idle → planning → awaiting approval without touching the page', () => {
    const state = run([
      { type: 'TASK_SUBMITTED', task },
      { type: 'PLAN_READY', plan },
    ]);
    expect(state.phase).toBe('awaiting_approval');
    expect(state.startedAt).toBeNull();
    expect(state.plan?.steps.every((step) => step.status === 'pending')).toBe(true);
  });

  it('ends a failed planning attempt without leaving the run stuck', () => {
    const state = run([
      { type: 'TASK_SUBMITTED', task },
      { type: 'PLAN_FAILED', message: 'Model unavailable.', at: 50 },
    ]);
    expect(state.phase).toBe('failed');
    expect(state.summary).toBe('Model unavailable.');
    expect(state.endedAt).toBe(50);
  });

  it('flags the irreversible step inside the plan, before anything runs', () => {
    const state = run([
      { type: 'TASK_SUBMITTED', task },
      { type: 'PLAN_READY', plan },
    ]);
    expect(state.plan?.steps.at(-1)?.requiresApproval).toBe(true);
  });

  it('records results as steps complete', () => {
    const state = run([
      ...approved,
      { type: 'STEP_STARTED', index: 0 },
      { type: 'STEP_SUCCEEDED', index: 0, result: 'Opened /orders' },
      { type: 'STEP_STARTED', index: 1 },
      { type: 'STEP_SUCCEEDED', index: 1, result: 'Found: Ethiopia Yirgacheffe 1kg — $23.40' },
    ]);
    expect(state.plan?.steps[1]?.status).toBe('done');
    expect(state.plan?.steps[1]?.result).toContain('$23.40');
    expect(progressLabel(state)).toBe('Step 2 of 4');
  });

  it('holds at a gate until the user decides, then continues', () => {
    const gated = run([...approved, { type: 'GATE_REACHED', index: 3 }]);
    expect(gated.phase).toBe('gated');
    expect(currentStep(gated)?.action).toBe('purchase');

    const continued = reduce(gated, { type: 'GATE_APPROVED' });
    expect(continued.phase).toBe('running');
  });

  it('marks a skipped gate as skipped and keeps going', () => {
    const state = run([...approved, { type: 'GATE_REACHED', index: 3 }, { type: 'GATE_SKIPPED' }]);
    expect(state.phase).toBe('running');
    expect(state.plan?.steps[3]?.status).toBe('skipped');
  });

  it('never advances a gated run without a decision', () => {
    const gated = run([...approved, { type: 'GATE_REACHED', index: 3 }]);
    expect(reduce(gated, { type: 'STEP_STARTED', index: 3 })).toEqual(gated);
    expect(reduce(gated, { type: 'RUN_COMPLETED', summary: 'x', at: 1 })).toEqual(gated);
  });

  it('hands the ball to the user on failure and takes it back on resume', () => {
    const stuck = run([
      ...approved,
      { type: 'STEP_STARTED', index: 2 },
      {
        type: 'STEP_FAILED',
        index: 2,
        reason: 'captcha',
        message: 'A CAPTCHA is blocking this page.',
      },
    ]);
    expect(stuck.phase).toBe('needs_help');
    expect(stuck.needsHelp?.reason).toBe('captcha');
    expect(stuck.plan?.steps[2]?.status).toBe('failed');

    const resumed = reduce(stuck, { type: 'HELP_RESOLVED' });
    expect(resumed.phase).toBe('running');
    expect(resumed.needsHelp).toBeNull();
    expect(resumed.plan?.steps[2]?.status).toBe('pending');
  });

  it('pauses and resumes only from the phases that allow it', () => {
    const running = run(approved);
    expect(canPause(running)).toBe(true);
    const paused = reduce(running, { type: 'PAUSE' });
    expect(paused.phase).toBe('paused');
    expect(reduce(paused, { type: 'PAUSE' })).toEqual(paused);
    expect(reduce(paused, { type: 'RESUME' }).phase).toBe('running');
  });

  it('stops from any active phase and keeps what was already done visible', () => {
    const state = run([
      ...approved,
      { type: 'STEP_STARTED', index: 0 },
      { type: 'STEP_SUCCEEDED', index: 0, result: 'Opened /orders' },
      { type: 'GATE_REACHED', index: 3 },
      { type: 'STOP', at: 500 },
    ]);
    expect(state.phase).toBe('stopped');
    expect(canStop(state)).toBe(false);
    expect(state.plan?.steps[0]?.status).toBe('done');
    expect(state.plan?.steps[3]?.status).toBe('skipped');
    expect(state.endedAt).toBe(500);
  });

  it('ignores a late step result from a stopped run', () => {
    const stopped = run([...approved, { type: 'STOP', at: 500 }]);
    expect(reduce(stopped, { type: 'STEP_SUCCEEDED', index: 0 })).toEqual(stopped);
  });

  it('refuses a second task while one is in flight', () => {
    const running = run(approved);
    expect(reduce(running, { type: 'TASK_SUBMITTED', task })).toEqual(running);
  });

  it('cancelling a plan leaves nothing behind', () => {
    const waiting = run([
      { type: 'TASK_SUBMITTED', task },
      { type: 'PLAN_READY', plan },
    ]);
    expect(reduce(waiting, { type: 'PLAN_CANCELLED' })).toEqual(initialRunState);

    // But a run already under way cannot be cancelled — only stopped.
    const running = run(approved);
    expect(reduce(running, { type: 'PLAN_CANCELLED' })).toEqual(running);
  });

  it('resets from any phase, ready for a new task', () => {
    const finished = run([...approved, { type: 'RUN_COMPLETED', summary: 'done', at: 1 }]);
    expect(reduce(finished, { type: 'RESET' })).toEqual(initialRunState);
  });

  it('ignores events that do not belong to the current phase', () => {
    const idle = initialRunState;
    expect(reduce(idle, { type: 'PLAN_APPROVED', at: 1 })).toEqual(idle);
    expect(reduce(idle, { type: 'GATE_APPROVED' })).toEqual(idle);
    expect(reduce(idle, { type: 'HELP_RESOLVED' })).toEqual(idle);
    expect(reduce(idle, { type: 'RESUME' })).toEqual(idle);
    expect(reduce(idle, { type: 'STOP', at: 1 })).toEqual(idle);

    const planning = reduce(idle, { type: 'TASK_SUBMITTED', task });
    expect(reduce(planning, { type: 'STEP_STARTED', index: 0 })).toEqual(planning);
    expect(progressLabel(planning)).toBeNull();
    expect(currentStep(planning)).toBeNull();
  });

  it('finishes with a summary', () => {
    const state = run([
      ...approved,
      { type: 'RUN_COMPLETED', summary: 'Order #4821 placed.', at: 900 },
    ]);
    expect(state.phase).toBe('done');
    expect(state.summary).toBe('Order #4821 placed.');
  });
});
