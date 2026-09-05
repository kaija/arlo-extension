import { useState } from 'react';

import type { RunState } from '../../core/types';
import { runCountLabel, runLine, runPercent, runToneColor } from '../run-presentation';
import { ChevronIcon } from '../../design-system/icons';
import { StepList } from './StepList';

interface RunCardProps {
  state: RunState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

/**
 * Collapsed is the normal state in a long thread: the dot, the count and one
 * line say where the run is. Expanding is for when that line is not enough.
 */
/**
 * Open by default while there is something to watch; closed once the run has an
 * outcome, where the one-line result is the point. The card is keyed on the
 * phase by its caller, so entering a gate or a hand-off reopens it — a decision
 * is never asked for behind a collapsed card.
 */
function opensBy(phase: RunState['phase']): boolean {
  return phase !== 'done' && phase !== 'stopped' && phase !== 'failed';
}

export function RunCard({ state, onPause, onResume, onStop }: RunCardProps) {
  const { phase } = state;
  const [expanded, setExpanded] = useState(() => opensBy(phase));

  if (!state.plan || !state.task) return null;

  const showControls = phase === 'running' || phase === 'paused';

  return (
    <section
      className={`panel-card run run--${phase}`}
      style={{ ['--run-accent' as string]: runToneColor(state) }}
    >
      <button
        type="button"
        className="run__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="run__dot" aria-hidden="true" />
        <span className="run__summary">
          <span className="run__heading">
            <span className="run__task">{state.task.prompt}</span>
            <span className="run__count">{runCountLabel(state)}</span>
          </span>
          <span className="run__line">{runLine(state)}</span>
        </span>
        <ChevronIcon className="run__chevron" />
      </button>

      <div className="run__progress" aria-hidden="true">
        <span style={{ width: `${runPercent(state)}%` }} />
      </div>

      {expanded ? <StepList state={state} /> : null}

      {showControls ? (
        <div className="run__controls">
          {phase === 'paused' ? (
            <button
              type="button"
              className="panel-btn panel-btn--xs panel-btn--secondary panel-btn--grow"
              onClick={onResume}
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              className="panel-btn panel-btn--xs panel-btn--secondary panel-btn--grow"
              onClick={onPause}
            >
              Pause
            </button>
          )}
          <button
            type="button"
            className="panel-btn panel-btn--xs panel-btn--danger panel-btn--grow"
            onClick={onStop}
          >
            Stop
          </button>
        </div>
      ) : null}
    </section>
  );
}
