import { ACTION_LABELS } from '../../core/gate-policy';
import type { PlanStep } from '../../core/types';

interface GateCardProps {
  step: PlanStep;
  onApprove: () => void;
  onSkip: () => void;
  onStop: () => void;
}

/**
 * The Gate must be decidable on its own: everything needed to say yes or no is
 * on this card, so the user never has to scroll back to the plan.
 */
export function GateCard({ step, onApprove, onSkip, onStop }: GateCardProps) {
  return (
    <section className="card card--gate">
      <header className="card__header">
        <h2 className="card__title">Arlo needs your confirmation</h2>
        <span className="badge badge--gate">Paused</span>
      </header>

      <p className="gate__action">{ACTION_LABELS[step.action]}</p>
      <p className="gate__detail">{step.title}</p>
      {step.gateDetail ? <p className="gate__consequence">{step.gateDetail}</p> : null}
      <p className="gate__warning">This cannot be undone.</p>

      <div className="actions actions--stacked">
        <button type="button" className="button button--primary" onClick={onApprove}>
          Approve
        </button>
        <button type="button" className="button" onClick={onSkip}>
          Skip this step
        </button>
        <button type="button" className="button button--danger" onClick={onStop}>
          Stop task
        </button>
      </div>
      <p className="card__note">
        Arlo waits here until you decide. It will not continue on its own.
      </p>
    </section>
  );
}
