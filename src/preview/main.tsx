/**
 * A design-fidelity board: every panel state at the real 400 x 760, using the
 * same script as the imported design so the two can be compared side by side.
 *
 * Dev-only. It is not one of the build inputs in vite.config.ts, so it never
 * reaches dist/. Serve it with `npx vite` and open /preview/index.html.
 */
import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { isGatedAction } from '../core/gate-policy';
import { initialRunState } from '../core/run-machine';
import type { Plan, RunState, StepStatus, Task } from '../core/types';
import type { TabInfo } from '../shared/messages';
import type { LlmProfileSummary } from '../shared/settings';
import { Composer } from '../sidepanel/components/Composer';
import { Dock } from '../sidepanel/components/Dock';
import { GateCard } from '../sidepanel/components/GateCard';
import { IdleScreen } from '../sidepanel/components/IdleScreen';
import { Onboarding } from '../sidepanel/components/Onboarding';
import { DoneOutcome, StoppedNotice } from '../sidepanel/components/Outcomes';
import { PanelHeader } from '../sidepanel/components/PanelHeader';
import { PlanCard, TaskMessage } from '../sidepanel/components/PlanCard';
import { PlanningCard } from '../sidepanel/components/PlanningCard';
import { RunCard } from '../sidepanel/components/RunCard';
import '../sidepanel/styles.css';
import './preview.css';

const tab: TabInfo = {
  tabId: 1,
  url: 'https://beanroast.co/products/ethiopia-yirgacheffe-1kg',
  title: 'Ethiopia Yirgacheffe 1kg — Beanroast',
  host: 'beanroast.co',
  blocked: false,
};

const profile: LlmProfileSummary = {
  id: 'p1',
  name: 'Anthropic',
  apiContract: 'anthropic-messages',
  model: 'claude-opus-5',
  origin: 'https://api.anthropic.com',
};

const task: Task = {
  id: 'task_1',
  prompt: 'Reorder the coffee beans I bought last month, but only if they’re still under $25.',
  createdAt: new Date('2026-09-04T14:41:00').getTime(),
  tabId: 1,
  url: tab.url,
  title: tab.title,
};

const SCRIPT = [
  { t: 'Open the orders page', r: 'Opened — 12 past orders', a: 'navigate' as const },
  {
    t: 'Find last month’s coffee order',
    r: 'Found: Ethiopia Yirgacheffe 1kg — $23.40',
    a: 'read' as const,
  },
  {
    t: 'Check the current price against $25',
    r: 'Confirmed $23.40 · under the limit',
    a: 'read' as const,
  },
  {
    t: 'Add 1 × Ethiopia Yirgacheffe 1kg to cart',
    r: 'Added — cart subtotal $23.40',
    a: 'click' as const,
  },
  {
    t: 'Go to checkout',
    r: 'Checkout loaded — Visa 4821, ship to Home',
    a: 'navigate' as const,
  },
  {
    t: 'Place the order — $25.87 total',
    r: 'Order placed — #A7F-40912',
    a: 'purchase' as const,
  },
  { t: 'Report the order number', r: 'Reported #A7F-40912', a: 'read' as const },
];

function makeState(statuses: StepStatus[], patch: Partial<RunState>): RunState {
  const plan: Plan = {
    id: 'plan_1',
    taskId: task.id,
    steps: SCRIPT.map((s, i) => ({
      id: `step_${i}`,
      title: s.t,
      action: s.a,
      requiresApproval: isGatedAction(s.a),
      status: statuses[i] ?? 'pending',
      ...(statuses[i] === 'done' ? { result: s.r } : {}),
      ...(s.a === 'purchase'
        ? {
            gateDetail: 'Charges Visa ending 4821 for $25.87, shipping to Home.',
            target: 'Place order — $25.87 (incl. $2.47 shipping)',
          }
        : {}),
    })),
  };
  return { ...initialRunState, task, plan, ...patch };
}

const D = 'done' as const;
const P = 'pending' as const;
const R = 'running' as const;

const planning = makeState([P, P, P, P, P, P, P], { phase: 'planning', currentStepIndex: -1 });
const awaiting = makeState([P, P, P, P, P, P, P], {
  phase: 'awaiting_approval',
  currentStepIndex: -1,
});
const running = makeState([D, D, D, R, P, P, P], { phase: 'running', currentStepIndex: 3 });
const gated = makeState([D, D, D, D, D, R, P], { phase: 'gated', currentStepIndex: 5 });
const done = makeState([D, D, D, D, D, D, D], {
  phase: 'done',
  currentStepIndex: 6,
  startedAt: 0,
  endedAt: 134_000,
  summary:
    'Order placed. #A7F-40912 — $25.87 charged to Visa ending 4821, arriving Thursday. Price was $23.40, under your $25 limit.',
});
const stopped = makeState([D, D, D, D, D, 'skipped', 'skipped'], {
  phase: 'stopped',
  currentStepIndex: 5,
  summary:
    'No order was submitted. The cart still holds 1 × Ethiopia Yirgacheffe 1kg — expand the card above to see everything Arlo did.',
});

const noop = () => {};

function Board({
  id,
  title,
  note,
  children,
}: React.PropsWithChildren<{ id: string; title: string; note: string }>) {
  return (
    <div className="board">
      <div className="board__label">
        <span className="board__id">{id}</span>
        <span className="board__title">{title}</span>
        <span className="board__note">{note}</span>
      </div>
      <div className="board__frame">
        <div className="panel">
          <PanelHeader onNewTask={noop} onOpenSettings={noop} />
          {children}
        </div>
      </div>
    </div>
  );
}

function Thread({ state, extra }: { state: RunState; extra?: React.ReactNode }) {
  // Mirrors the panel: a plan opens at the top, everything else at the bottom.
  const thread = useRef<HTMLDivElement>(null);
  const top = state.phase === 'planning' || state.phase === 'awaiting_approval';
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = top ? 0 : el.scrollHeight;
  }, [top]);

  return (
    <>
      <div className="thread" ref={thread}>
        <TaskMessage task={task} />
        {state.phase === 'planning' ? (
          <PlanningCard tab={tab} />
        ) : state.phase === 'awaiting_approval' ? (
          <PlanCard plan={state.plan!} host={tab.host} onApprove={noop} onCancel={noop} />
        ) : (
          <RunCard state={state} onPause={noop} onResume={noop} onStop={noop} />
        )}
        {extra}
      </div>
      <Dock profile={profile}>
        <Composer
          placeholder={
            state.phase === 'done' || state.phase === 'stopped'
              ? 'Ask a follow-up or start a new task…'
              : 'Arlo is working — pause or stop it to change the task'
          }
          disabled={state.phase !== 'done' && state.phase !== 'stopped'}
          onSubmit={noop}
        />
      </Dock>
    </>
  );
}

function Preview() {
  return (
    <div className="canvas">
      <h1 className="canvas__title">Arlo side panel — built against the imported design</h1>
      <p className="canvas__lead">
        Every board is 400 × 760, the real Chrome MV3 side panel. Compare against
        <code> Arlo Side Panel.dc.html</code>, group B.
      </p>
      <div className="row">
        <Board id="B1" title="Empty state" note="site-aware suggestions">
          <>
            <IdleScreen tab={tab} busy={false} onSubmit={noop} />
            <Dock profile={profile}>
              <Composer
                placeholder="Reorder the coffee beans I bought last month…"
                onSubmit={noop}
              />
            </Dock>
          </>
        </Board>
        <Board id="B2" title="Planning" note="reading the page, nothing done">
          <Thread state={planning} />
        </Board>
        <Board id="B3" title="Plan awaiting approval" note="nothing runs until approved">
          <Thread state={awaiting} />
        </Board>
        <Board id="B4" title="Running" note="four step states at once">
          <Thread state={running} />
        </Board>
        <Board id="B6" title="Gate" note="decidable without scrolling back">
          <Thread
            state={gated}
            extra={
              <GateCard
                step={gated.plan!.steps[5]!}
                position={6}
                total={7}
                onApprove={noop}
                onSkip={noop}
                onStop={noop}
              />
            }
          />
        </Board>
        <Board id="B7" title="Done" note="one-line result, expandable">
          <Thread state={done} extra={<DoneOutcome state={done} onNewTask={noop} />} />
        </Board>
        <Board id="B8" title="Stopped" note="nothing was submitted">
          <Thread state={stopped} extra={<StoppedNotice state={stopped} />} />
        </Board>
        <Board id="A2" title="Onboarding" note="site access, asked in context">
          <Onboarding onAllow={noop} />
        </Board>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
