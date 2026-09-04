import { ACTION_LABELS } from '../../core/gate-policy';
import type { PlanStep } from '../../core/types';

const STATUS_MARK: Record<PlanStep['status'], string> = {
  pending: '○',
  running: '◐',
  done: '●',
  failed: '✕',
  skipped: '–',
};

export function StepList({ steps }: { steps: PlanStep[] }) {
  return (
    <ol className="steps">
      {steps.map((step, index) => (
        <li key={step.id} className={`step step--${step.status}`}>
          <span className="step__mark" aria-hidden="true">
            {STATUS_MARK[step.status]}
          </span>
          <div className="step__body">
            <p className="step__title">
              <span className="step__index">{index + 1}.</span> {step.title}
            </p>
            {step.requiresApproval && step.status === 'pending' ? (
              <p className="step__flag">Needs your confirmation — {ACTION_LABELS[step.action]}</p>
            ) : null}
            {step.result ? <p className="step__result">{step.result}</p> : null}
            {step.error ? <p className="step__error">{step.error}</p> : null}
          </div>
          <span className="step__status">{step.status}</span>
        </li>
      ))}
    </ol>
  );
}
