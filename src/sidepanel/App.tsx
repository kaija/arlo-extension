import { currentStep } from '../core/run-machine';
import type { RunState } from '../core/types';
import type { TabInfo } from '../shared/messages';
import { contractLabel, type LlmProfileSummary } from '../shared/settings';
import { Composer } from './components/Composer';
import { GateCard } from './components/GateCard';
import { NeedsHelpCard } from './components/NeedsHelpCard';
import { Onboarding } from './components/Onboarding';
import { PlanCard, TaskMessage } from './components/PlanCard';
import { RunCard } from './components/RunCard';
import { useArlo, type Arlo } from './useArlo';

export function App() {
  const arlo = useArlo();

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__brand">Arlo</span>
        <div className="app__header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => void arlo.send({ type: 'run:reset' })}
          >
            + New
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            Settings
          </button>
        </div>
      </header>

      <main className="app__body">
        {arlo.error ? (
          <div className="alert" role="alert">
            <div className="alert__body">
              <span>{arlo.error.message}</span>
              {arlo.error.diagnostic ? (
                <details className="alert__details">
                  <summary>Technical details</summary>
                  <span>{contractLabel(arlo.error.diagnostic.apiContract)}</span>
                  <span>{arlo.error.diagnostic.endpoint}</span>
                  {arlo.error.diagnostic.status ? (
                    <span>HTTP {arlo.error.diagnostic.status}</span>
                  ) : null}
                  {arlo.error.diagnostic.requestId ? (
                    <span>Request {arlo.error.diagnostic.requestId}</span>
                  ) : null}
                  {arlo.error.diagnostic.responseExcerpt ? (
                    <span>{arlo.error.diagnostic.responseExcerpt}</span>
                  ) : null}
                </details>
              ) : null}
            </div>
            <button type="button" className="icon-button" onClick={arlo.dismissError}>
              Dismiss
            </button>
          </div>
        ) : null}

        {!arlo.granted ? (
          <Onboarding onAllow={() => void arlo.requestSiteAccess()} />
        ) : arlo.tab?.blocked ? (
          <BlockedNotice />
        ) : (
          <RunView arlo={arlo} />
        )}
      </main>
    </div>
  );
}

function BlockedNotice() {
  return (
    <section className="panel">
      <h1 className="panel__title">Arlo is switched off here</h1>
      <p className="panel__lead">
        This site is on your block list, or Arlo is paused everywhere. Both are in Settings.
      </p>
      <button type="button" className="button" onClick={() => chrome.runtime.openOptionsPage()}>
        Open settings
      </button>
    </section>
  );
}

function RunThread({ arlo, state }: { arlo: Arlo; state: RunState }) {
  if (!state.task) return null;
  return (
    <>
      <TaskMessage prompt={state.task.prompt} />
      <RunCard
        state={state}
        onPause={() => void arlo.send({ type: 'run:pause' })}
        onResume={() => void arlo.send({ type: 'run:resume' })}
        onStop={() => void arlo.send({ type: 'run:stop' })}
        onNewTask={() => void arlo.send({ type: 'run:reset' })}
      />
    </>
  );
}

function ComposerBlock({ arlo, tab }: { arlo: Arlo; tab: TabInfo | null }) {
  if (!arlo.profile) return <ModelSetupNotice />;
  return (
    <>
      <ProfileIndicator profile={arlo.profile} />
      <Composer tab={tab} disabled={arlo.loading} onSubmit={(p) => void arlo.submit(p)} />
    </>
  );
}

function ProfileIndicator({ profile }: { profile: LlmProfileSummary }) {
  return (
    <button
      type="button"
      className="profile-indicator"
      title={`Requests go directly to ${profile.origin}`}
      onClick={() => chrome.runtime.openOptionsPage()}
    >
      <span>
        <strong>{profile.name}</strong>
        <span>{profile.model}</span>
      </span>
      <span aria-hidden="true">AI settings →</span>
    </button>
  );
}

function ModelSetupNotice() {
  return (
    <section className="panel">
      <h1 className="panel__title">Connect an AI model to start</h1>
      <p className="panel__lead">
        Add an Anthropic or OpenAI-compatible profile and choose the default model Arlo should use.
      </p>
      <button
        type="button"
        className="button button--primary"
        onClick={() => chrome.runtime.openOptionsPage()}
      >
        Open AI settings
      </button>
    </section>
  );
}

function RunView({ arlo }: { arlo: Arlo }) {
  const { state, tab } = arlo;
  const step = currentStep(state);

  switch (state.phase) {
    case 'idle':
      return <ComposerBlock arlo={arlo} tab={tab} />;

    case 'planning':
      return (
        <>
          {state.task ? <TaskMessage prompt={state.task.prompt} /> : null}
          <section className="card card--planning" aria-busy="true">
            <p className="run__status">Reading this page and working out a plan…</p>
          </section>
        </>
      );

    case 'awaiting_approval':
      return state.task && state.plan ? (
        <PlanCard
          task={state.task}
          plan={state.plan}
          onApprove={() => void arlo.send({ type: 'run:approve-plan' })}
          onCancel={() => void arlo.send({ type: 'run:cancel' })}
        />
      ) : null;

    case 'gated':
      return (
        <>
          <RunThread arlo={arlo} state={state} />
          {step ? (
            <GateCard
              step={step}
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
          <RunThread arlo={arlo} state={state} />
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
    case 'stopped':
      return (
        <>
          <RunThread arlo={arlo} state={state} />
          <ComposerBlock arlo={arlo} tab={tab} />
        </>
      );

    case 'failed':
      return (
        <>
          {state.task ? <TaskMessage prompt={state.task.prompt} /> : null}
          <section className="card card--help">
            <div className="card__header">
              <h2 className="card__title">Couldn’t create a plan</h2>
              <span className="badge badge--help">Failed</span>
            </div>
            <p className="card__note">
              {state.summary ?? 'Check the AI connection and try again.'}
            </p>
          </section>
          <ComposerBlock arlo={arlo} tab={tab} />
        </>
      );

    default:
      return <RunThread arlo={arlo} state={state} />;
  }
}
