import { useEffect, useRef } from 'react';

import { currentStep } from '../core/run-machine';
import type { RunState } from '../core/types';
import { contractLabel } from '../shared/settings';
import { Composer } from './components/Composer';
import { Dock } from './components/Dock';
import { GateCard } from './components/GateCard';
import { IdleScreen } from './components/IdleScreen';
import { NeedsHelpCard } from './components/NeedsHelpCard';
import { BlockedScreen, ModelSetupScreen, Onboarding } from './components/Onboarding';
import { DoneOutcome, FailedNotice, StoppedNotice } from './components/Outcomes';
import { PanelHeader } from './components/PanelHeader';
import { PlanCard, TaskMessage } from './components/PlanCard';
import { PlanningCard } from './components/PlanningCard';
import { RunCard } from './components/RunCard';
import { CloseIcon, WarningIcon } from '../design-system/icons';
import { useArlo, type Arlo } from './useArlo';

export function App() {
  const arlo = useArlo();

  return (
    <div className="panel">
      <PanelHeader
        onNewTask={() => void arlo.send({ type: 'run:reset' })}
        onOpenSettings={() => chrome.runtime.openOptionsPage()}
      />

      {arlo.error ? <ErrorAlert arlo={arlo} /> : null}

      {!arlo.granted ? (
        <Onboarding onAllow={() => void arlo.requestSiteAccess()} />
      ) : arlo.tab?.blocked ? (
        <BlockedScreen />
      ) : !arlo.profile ? (
        <ModelSetupScreen />
      ) : arlo.state.phase === 'idle' ? (
        <>
          <IdleScreen
            tab={arlo.tab}
            busy={arlo.loading}
            onSubmit={(prompt) => void arlo.submit(prompt)}
          />
          <Dock profile={arlo.profile}>
            <Composer
              placeholder="Reorder the coffee beans I bought last month…"
              disabled={arlo.loading}
              onSubmit={(prompt) => void arlo.submit(prompt)}
            />
          </Dock>
        </>
      ) : (
        <Thread arlo={arlo} />
      )}
    </div>
  );
}

function ErrorAlert({ arlo }: { arlo: Arlo }) {
  const { error } = arlo;
  if (!error) return null;

  return (
    <div className="panel-alert" role="alert">
      <WarningIcon size={15} />
      <div className="panel-alert__body">
        <span>{error.message}</span>
        {error.diagnostic ? (
          <details className="panel-alert__details">
            <summary>Technical details</summary>
            <span>{contractLabel(error.diagnostic.apiContract)}</span>
            <span>{error.diagnostic.endpoint}</span>
            {error.diagnostic.status ? <span>HTTP {error.diagnostic.status}</span> : null}
            {error.diagnostic.requestId ? <span>Request {error.diagnostic.requestId}</span> : null}
            {error.diagnostic.responseExcerpt ? (
              <span>{error.diagnostic.responseExcerpt}</span>
            ) : null}
          </details>
        ) : null}
      </div>
      <button
        type="button"
        className="panel-alert__dismiss"
        onClick={arlo.dismissError}
        title="Dismiss"
      >
        <CloseIcon />
        <span className="visually-hidden">Dismiss</span>
      </button>
    </div>
  );
}

/**
 * A run is a thread: what was asked, what Arlo is doing about it, and whatever
 * it needs from the user right now — with the composer always in reach.
 */
function Thread({ arlo }: { arlo: Arlo }) {
  const { state } = arlo;
  const thread = useRef<HTMLDivElement>(null);
  const { phase, currentStepIndex } = state;

  /*
   * Put the thing that matters in view. A plan is read from step 1, so it opens
   * at the top. Everything else grows downwards: a gate or a hand-off always
   * wins — Arlo is blocked until the user answers, so the ask must never sit
   * below the fold — and a run only follows along if the user was already at
   * the bottom, so scrolling back to re-read something is not fought.
   */
  useEffect(() => {
    const el = thread.current;
    if (!el) return;
    if (phase === 'planning' || phase === 'awaiting_approval') {
      el.scrollTop = 0;
      return;
    }
    const mustSee = phase === 'gated' || phase === 'needs_help';
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (mustSee || nearBottom) el.scrollTop = el.scrollHeight;
  }, [phase, currentStepIndex]);

  return (
    <>
      <div className="thread" ref={thread}>
        {state.task ? <TaskMessage task={state.task} /> : null}
        <ThreadBody arlo={arlo} />
      </div>
      <Dock profile={arlo.profile}>
        <Composer
          placeholder={composerHint(state)}
          disabled={!isFinished(state) || arlo.loading}
          onSubmit={(prompt) => void arlo.submit(prompt)}
        />
      </Dock>
    </>
  );
}

function ThreadBody({ arlo }: { arlo: Arlo }) {
  const { state } = arlo;
  const step = currentStep(state);
  // Keyed on the phase so the card reopens itself when the run needs something.
  const run = (
    <RunCard
      key={state.phase}
      state={state}
      onPause={() => void arlo.send({ type: 'run:pause' })}
      onResume={() => void arlo.send({ type: 'run:resume' })}
      onStop={() => void arlo.send({ type: 'run:stop' })}
    />
  );

  switch (state.phase) {
    case 'planning':
      return <PlanningCard tab={arlo.tab} />;

    case 'awaiting_approval':
      return state.plan ? (
        <PlanCard
          plan={state.plan}
          host={arlo.tab?.host}
          onApprove={() => void arlo.send({ type: 'run:approve-plan' })}
          onCancel={() => void arlo.send({ type: 'run:cancel' })}
        />
      ) : null;

    case 'gated':
      return (
        <>
          {run}
          {step ? (
            <GateCard
              step={step}
              position={state.currentStepIndex + 1}
              total={state.plan?.steps.length ?? 0}
              onApprove={() => void arlo.send({ type: 'run:gate', decision: 'approve' })}
              onSkip={() => void arlo.send({ type: 'run:gate', decision: 'skip' })}
              onStop={() => void arlo.send({ type: 'run:gate', decision: 'stop' })}
            />
          ) : null}
        </>
      );

    case 'needs_help':
      return (
        <>
          {run}
          {state.needsHelp ? (
            <NeedsHelpCard
              needsHelp={state.needsHelp}
              step={step}
              onResume={() => void arlo.send({ type: 'run:resume-after-help' })}
              onStop={() => void arlo.send({ type: 'run:stop' })}
            />
          ) : null}
        </>
      );

    case 'done':
      return (
        <>
          {run}
          <DoneOutcome state={state} onNewTask={() => void arlo.send({ type: 'run:reset' })} />
        </>
      );

    case 'stopped':
      return (
        <>
          {run}
          <StoppedNotice state={state} />
        </>
      );

    case 'failed':
      return <FailedNotice state={state} onRetry={() => void arlo.send({ type: 'run:reset' })} />;

    default:
      return run;
  }
}

/** Terminal phases are the only ones where a new prompt can start anything. */
function isFinished(state: RunState): boolean {
  return state.phase === 'done' || state.phase === 'stopped' || state.phase === 'failed';
}

function composerHint(state: RunState): string {
  if (isFinished(state)) return 'Ask a follow-up or start a new task…';
  if (state.phase === 'gated') return 'Answer above before Arlo can carry on';
  return 'Arlo is working — pause or stop it to change the task';
}
