import { initialRunState, reduce, type RunEvent } from '../core/run-machine';
import type { NeedsHelpReason, PlanStep, RunState, Task } from '../core/types';
import { newId, sendToContent, type BackgroundEvent } from '../shared/messages';
import { isBlockedUrl, loadSettings } from '../shared/settings';
import { ensureInjected } from './content-registration';
import { createPlanner, type PageContext } from './planner';

/** One run per tab. Nothing is shared between tabs. */
const runs = new Map<number, RunState>();
/** Gate decisions already made, so an approved step is not asked about twice. */
const approvedGates = new Map<number, Set<string>>();
/** Tabs whose step loop is currently turning, to keep it single-threaded. */
const pumping = new Set<number>();

const STEP_PACING_MS = 350;

export function getRun(tabId: number): RunState {
  return runs.get(tabId) ?? initialRunState;
}

export function forgetTab(tabId: number): void {
  runs.delete(tabId);
  approvedGates.delete(tabId);
  pumping.delete(tabId);
}

function broadcast(tabId: number, state: RunState): void {
  const message: BackgroundEvent = { type: 'run:state', tabId, state };
  // The side panel may be closed; a missing receiver is not an error.
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}

function dispatch(tabId: number, event: RunEvent): RunState {
  const next = reduce(getRun(tabId), event);
  runs.set(tabId, next);
  broadcast(tabId, next);
  return next;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readPage(tabId: number): Promise<PageContext> {
  const tab = await chrome.tabs.get(tabId);
  const response = await sendToContent(tabId, { type: 'content:read' });
  return {
    url: tab.url ?? '',
    title: tab.title ?? '',
    text: response.ok ? (response.text ?? '') : '',
  };
}

export async function submitTask(tabId: number, prompt: string): Promise<RunState> {
  const settings = await loadSettings();
  if (settings.pausedEverywhere) {
    throw new Error('Arlo is paused everywhere. Turn it back on in Settings.');
  }

  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? '';
  if (isBlockedUrl(url, settings.blockedDomains)) {
    throw new Error('Arlo is blocked on this site. Edit the block list in Settings.');
  }

  const task: Task = {
    id: newId('task'),
    prompt,
    createdAt: Date.now(),
    tabId,
    url,
    title: tab.title ?? '',
  };
  approvedGates.delete(tabId);
  dispatch(tabId, { type: 'TASK_SUBMITTED', task });

  try {
    await ensureInjected(tabId);
  } catch {
    // Already injected, or a page we may not touch; readPage degrades gracefully.
  }
  const page = await readPage(tabId);
  try {
    const plan = await createPlanner(settings).createPlan(prompt, page, task.id);
    return dispatch(tabId, { type: 'PLAN_READY', plan });
  } catch (cause) {
    dispatch(tabId, {
      type: 'PLAN_FAILED',
      message: cause instanceof Error ? cause.message : 'Arlo could not create a plan.',
      at: Date.now(),
    });
    throw cause;
  }
}

export function approvePlan(tabId: number): RunState {
  const state = dispatch(tabId, { type: 'PLAN_APPROVED', at: Date.now() });
  void pump(tabId);
  return state;
}

export function decideGate(tabId: number, decision: 'approve' | 'skip' | 'stop'): RunState {
  const state = getRun(tabId);
  const step = state.plan?.steps[state.currentStepIndex];

  if (decision === 'stop') return stopRun(tabId);

  if (decision === 'approve' && step) {
    const approved = approvedGates.get(tabId) ?? new Set<string>();
    approved.add(step.id);
    approvedGates.set(tabId, approved);
  }

  const next = dispatch(
    tabId,
    decision === 'approve' ? { type: 'GATE_APPROVED' } : { type: 'GATE_SKIPPED' },
  );
  void pump(tabId);
  return next;
}

export function pauseRun(tabId: number): RunState {
  return dispatch(tabId, { type: 'PAUSE' });
}

export function resumeRun(tabId: number): RunState {
  const state = dispatch(tabId, { type: 'RESUME' });
  void pump(tabId);
  return state;
}

/** After the user has taken over — signed in, solved a CAPTCHA, clicked it themselves. */
export function resumeAfterHelp(tabId: number): RunState {
  const state = dispatch(tabId, { type: 'HELP_RESOLVED' });
  void pump(tabId);
  return state;
}

export function stopRun(tabId: number): RunState {
  const state = dispatch(tabId, { type: 'STOP', at: Date.now() });
  void sendToContent(tabId, { type: 'content:clear-highlight' });
  return state;
}

export function cancelPlan(tabId: number): RunState {
  return dispatch(tabId, { type: 'PLAN_CANCELLED' });
}

export function resetRun(tabId: number): RunState {
  approvedGates.delete(tabId);
  return dispatch(tabId, { type: 'RESET' });
}

type StepOutcome =
  { ok: true; result?: string } | { ok: false; reason: NeedsHelpReason; message: string };

async function executeStep(tabId: number, step: PlanStep): Promise<StepOutcome> {
  if (step.target) {
    await sendToContent(tabId, {
      type: 'content:highlight',
      selector: step.target,
      label: step.title,
    });
  }

  switch (step.action) {
    case 'navigate':
    case 'open_tab': {
      const tab = await chrome.tabs.get(tabId);
      const target = new URL(step.target ?? '/', tab.url ?? 'about:blank').toString();
      if (step.action === 'open_tab') {
        await chrome.tabs.create({ url: target, active: false });
      } else {
        await chrome.tabs.update(tabId, { url: target });
        await waitForLoad(tabId);
      }
      return { ok: true, result: target };
    }

    case 'read': {
      const page = await readPage(tabId);
      return { ok: true, result: page.title || page.url };
    }

    case 'scroll': {
      const response = await sendToContent(tabId, {
        type: 'content:scroll',
        ...(step.target !== undefined ? { selector: step.target } : {}),
      });
      return response.ok ? { ok: true } : toFailure(response.error, response.reason);
    }

    case 'type': {
      const response = await sendToContent(tabId, {
        type: 'content:type',
        selector: step.target ?? '',
        value: step.value ?? '',
      });
      return response.ok ? { ok: true } : toFailure(response.error, response.reason);
    }

    default: {
      // Click-like actions, including the gated ones the user has just approved.
      const response = await sendToContent(tabId, {
        type: 'content:click',
        selector: step.target ?? '',
      });
      return response.ok ? { ok: true } : toFailure(response.error, response.reason);
    }
  }
}

function toFailure(message: string, reason?: NeedsHelpReason): StepOutcome {
  return { ok: false, reason: reason ?? 'element_not_found', message };
}

function waitForLoad(tabId: number, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (updatedTabId: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (updatedTabId === tabId && info.status === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Walks the plan one step at a time. Re-reads state on every turn so a Pause,
 * Stop or Gate decision taken mid-flight is respected before the next action.
 */
async function pump(tabId: number): Promise<void> {
  if (pumping.has(tabId)) return;
  pumping.add(tabId);
  try {
    for (;;) {
      const state = getRun(tabId);
      if (state.phase !== 'running' || !state.plan) return;

      const index = state.plan.steps.findIndex((step) => step.status === 'pending');
      if (index === -1) {
        const summary = lastResult(state) ?? 'Task complete.';
        dispatch(tabId, { type: 'RUN_COMPLETED', summary, at: Date.now() });
        void sendToContent(tabId, { type: 'content:clear-highlight' });
        return;
      }

      const step = state.plan.steps[index];
      if (!step) return;

      const approved = approvedGates.get(tabId)?.has(step.id) ?? false;
      if (step.requiresApproval && !approved) {
        dispatch(tabId, { type: 'GATE_REACHED', index });
        return;
      }

      dispatch(tabId, { type: 'STEP_STARTED', index });
      const outcome = await executeStep(tabId, step);
      if (outcome.ok) {
        dispatch(tabId, {
          type: 'STEP_SUCCEEDED',
          index,
          ...(outcome.result !== undefined ? { result: outcome.result } : {}),
        });
      } else {
        dispatch(tabId, {
          type: 'STEP_FAILED',
          index,
          reason: outcome.reason,
          message: outcome.message,
        });
        return;
      }
      await sleep(STEP_PACING_MS);
    }
  } finally {
    pumping.delete(tabId);
  }
}

function lastResult(state: RunState): string | null {
  const done = state.plan?.steps.filter((step) => step.status === 'done') ?? [];
  return done.at(-1)?.result ?? null;
}
