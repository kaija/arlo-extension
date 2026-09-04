import { useState } from 'react';

import { currentStep, progressLabel } from '../../core/run-machine';
import type { RunState } from '../../core/types';
import { StepList } from './StepList';

interface RunCardProps {
  state: RunState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNewTask: () => void;
}

const BADGES: Partial<Record<RunState['phase'], string>> = {
  running: 'Running',
  paused: 'Paused',
  gated: 'Waiting for you',
  done: 'Done',
  stopped: 'Stopped',
  needs_help: 'Over to you',
};

/**
 * The collapsed form is the normal state in a long thread: task, progress and
 * what it is doing right now, without expanding.
 */
export function RunCard({ state, onPause, onResume, onStop, onNewTask }: RunCardProps) {
  const finished = state.phase === 'done' || state.phase === 'stopped';
  const [expanded, setExpanded] = useState(!finished);
  const step = currentStep(state);
  if (!state.plan || !state.task) return null;

  return (
    <section className={`card card--run card--${state.phase}`}>
      <header className="card__header">
        <button
          type="button"
          className="card__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? '▾' : '▸'} {state.task.prompt}
        </button>
        <span className={`badge badge--${state.phase}`}>{BADGES[state.phase] ?? state.phase}</span>
      </header>

      <p className="run__status">
        {finished ? (
          (state.summary ?? 'Run ended.')
        ) : (
          <>
            <span className="run__progress">{progressLabel(state)}</span>
            {step ? ` — ${step.title}` : null}
          </>
        )}
      </p>

      {expanded ? <StepList steps={state.plan.steps} /> : null}

      <div className="actions">
        {state.phase === 'running' ? (
          <button type="button" className="button" onClick={onPause}>
            Pause
          </button>
        ) : null}
        {state.phase === 'paused' ? (
          <button type="button" className="button button--primary" onClick={onResume}>
            Resume
          </button>
        ) : null}
        {!finished ? (
          <button type="button" className="button button--danger" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="button" className="button button--primary" onClick={onNewTask}>
            New task
          </button>
        )}
      </div>
    </section>
  );
}
