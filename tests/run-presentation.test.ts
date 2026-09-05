import { describe, expect, it } from 'vitest';

import { isGatedAction } from '../src/core/gate-policy';
import { initialRunState } from '../src/core/run-machine';
import type { Plan, RunState, StepStatus, Task } from '../src/core/types';
import {
  runCountLabel,
  runLine,
  runPercent,
  runTone,
  stepMark,
  stepTone,
} from '../src/sidepanel/run-presentation';

const task: Task = {
  id: 'task_1',
  prompt: 'Reorder the coffee beans I bought last month.',
  createdAt: 0,
  tabId: 1,
  url: 'https://shop.example/orders',
  title: 'Orders',
};

const drafts = [
  { title: 'Open your order history', action: 'navigate' as const },
  { title: 'Find the beans', action: 'read' as const },
  { title: 'Add to cart', action: 'click' as const },
  { title: 'Place the order', action: 'purchase' as const },
];

function makeState(statuses: StepStatus[], patch: Partial<RunState> = {}): RunState {
  const plan: Plan = {
    id: 'plan_1',
    taskId: task.id,
    steps: drafts.map((draft, index) => ({
      id: `step_${index}`,
      title: draft.title,
      action: draft.action,
      requiresApproval: isGatedAction(draft.action),
      status: statuses[index] ?? 'pending',
    })),
  };
  return { ...initialRunState, task, plan, ...patch };
}

describe('run presentation', () => {
  it('counts the position while running and where it landed once it stopped', () => {
    const running = makeState(['done', 'done', 'running', 'pending'], {
      phase: 'running',
      currentStepIndex: 2,
    });
    expect(runCountLabel(running)).toBe('Step 3 of 4');

    expect(runCountLabel({ ...running, phase: 'done' })).toBe('4 of 4');
    expect(runCountLabel({ ...running, phase: 'stopped' })).toBe('stopped at 3 of 4');
  });

  it('measures progress by finished steps, not by the index', () => {
    const state = makeState(['done', 'skipped', 'running', 'pending'], {
      phase: 'running',
      currentStepIndex: 2,
    });
    expect(runPercent(state)).toBe(50);
    expect(runPercent({ ...state, phase: 'done' })).toBe(100);
  });

  it('says what a gate is waiting on, in the words of the action', () => {
    const gated = makeState(['done', 'done', 'done', 'running'], {
      phase: 'gated',
      currentStepIndex: 3,
    });
    expect(runLine(gated)).toBe('Waiting for your OK before it places the order');
    expect(runTone(gated)).toBe('warning');
  });

  it('keeps a finished run to one short line — the summary is printed below it', () => {
    const done = makeState(['done', 'done', 'done', 'done'], {
      phase: 'done',
      currentStepIndex: 3,
      summary: 'Order placed — #A7F-40912',
      startedAt: 0,
      endedAt: 134_000,
    });
    expect(runLine(done)).toBe('Done · 2m 14s');
    expect(runLine({ ...done, startedAt: null, endedAt: null })).toBe('Done');
    expect(runTone(done)).toBe('success');
  });

  it('names the current step while it runs, and the pause while it is held', () => {
    const running = makeState(['done', 'running', 'pending', 'pending'], {
      phase: 'running',
      currentStepIndex: 1,
    });
    expect(runLine(running)).toBe('Find the beans');
    expect(runLine({ ...running, phase: 'paused' })).toBe('Paused by you — nothing running');
  });

  it('gives every step in a gated run its own tone', () => {
    const gated = makeState(['done', 'done', 'done', 'running'], {
      phase: 'gated',
      currentStepIndex: 3,
    });
    expect(gated.plan?.steps.map((_, i) => stepTone(gated, i))).toEqual([
      'done',
      'done',
      'done',
      'gate',
    ]);
  });

  it('numbers steps that have not started and marks the ones that have', () => {
    const running = makeState(['done', 'running', 'pending', 'pending'], {
      phase: 'running',
      currentStepIndex: 1,
    });
    expect(stepMark(stepTone(running, 2), 2)).toBe('3');
    expect(stepMark(stepTone(running, 0), 0)).toBe('✓');
    // The running dot carries a spinner, so it holds no glyph.
    expect(stepMark(stepTone(running, 1), 1)).toBe('');
  });

  it('holds the current step rather than running it while paused', () => {
    const paused = makeState(['done', 'running', 'pending', 'pending'], {
      phase: 'paused',
      currentStepIndex: 1,
    });
    expect(stepTone(paused, 1)).toBe('held');
    expect(stepMark('held', 1)).toBe('·');
  });
});
