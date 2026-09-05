import type { RunState } from '../../core/types';
import { StopIcon, WarningIcon } from '../../design-system/icons';

/** The one-line result of a finished run, with the obvious next moves. */
export function DoneOutcome({ state, onNewTask }: { state: RunState; onNewTask: () => void }) {
  return (
    <div className="outcome">
      <p className="outcome__text">{state.summary ?? 'Done.'}</p>
      <div className="outcome__actions">
        <button
          type="button"
          className="panel-btn panel-btn--chip panel-btn--secondary"
          onClick={onNewTask}
        >
          Start a new task
        </button>
      </div>
    </div>
  );
}

export function StoppedNotice({ state }: { state: RunState }) {
  const total = state.plan?.steps.length ?? 0;
  const position = Math.min(Math.max(state.currentStepIndex + 1, 1), Math.max(total, 1));

  return (
    <div className="notice notice--danger">
      <StopIcon size={15} />
      <div className="notice__body">
        <p className="notice__title">
          Stopped at step {position} of {total}
        </p>
        <p className="notice__text">
          {state.summary ??
            'Nothing further was submitted. Expand the card above to see everything Arlo did.'}
        </p>
      </div>
    </div>
  );
}

export function FailedNotice({ state, onRetry }: { state: RunState; onRetry: () => void }) {
  return (
    <div className="notice notice--warning">
      <WarningIcon size={15} />
      <div className="notice__body">
        <p className="notice__title">Couldn’t create a plan</p>
        <p className="notice__text">
          {state.summary ?? 'Check the AI connection in settings and try again.'}
        </p>
        <div className="notice__actions">
          <button
            type="button"
            className="panel-btn panel-btn--chip panel-btn--secondary"
            onClick={onRetry}
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}
