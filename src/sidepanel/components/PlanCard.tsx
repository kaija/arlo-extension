import type { Plan, Task } from '../../core/types';
import { WarningIcon } from '../../design-system/icons';

interface PlanCardProps {
  plan: Plan;
  host: string | undefined;
  onApprove: () => void;
  onCancel: () => void;
}

/**
 * The plan is the contract: every step is listed, the irreversible ones are
 * flagged, and nothing runs until this card is approved.
 */
export function PlanCard({ plan, host, onApprove, onCancel }: PlanCardProps) {
  const count = plan.steps.length;

  return (
    <section className="panel-card">
      <div className="plan__head">
        <span className="panel-badge">Plan · not started</span>
        <h2 className="plan__title">
          {count} {count === 1 ? 'step' : 'steps'}
          {host ? ` on ${host}` : ''}
        </h2>
        <p className="plan__lead">
          Nothing has happened yet. Arlo runs this only after you approve it.
        </p>
      </div>

      <ol className="plan__steps">
        {plan.steps.map((step, index) => (
          <li className="plan-step" key={step.id}>
            <span className="plan-step__n">{index + 1}</span>
            <div className="plan-step__body">
              <p className="plan-step__title">{step.title}</p>
              {step.requiresApproval ? (
                <span className="gate-pill">
                  <WarningIcon size={11} />
                  Will stop for your OK · can’t be undone
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="panel-card__foot">
        <button
          type="button"
          className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
          onClick={onApprove}
        >
          Approve and run
        </button>
        <div className="panel-btn-row">
          <button
            type="button"
            className="panel-btn panel-btn--sm panel-btn--ghost panel-btn--grow"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

export function TaskMessage({ task }: { task: Task }) {
  const time = new Date(task.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <section className="task-message">
      <p className="task-message__label">You · {time}</p>
      <p className="task-message__text">{task.prompt}</p>
    </section>
  );
}
