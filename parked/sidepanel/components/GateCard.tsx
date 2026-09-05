import { ACTION_LABELS, GATE_APPROVE_LABELS } from '../../core/gate-policy';
import type { PlanStep } from '../../core/types';
import { InfoIcon, WarningIcon } from '../../design-system/icons';

interface GateCardProps {
  step: PlanStep;
  /** 1-based position of this step, shown so the gate locates itself in the run. */
  position?: number;
  total?: number;
  onApprove: () => void;
  onSkip: () => void;
  onStop: () => void;
}

/**
 * The Gate must be decidable on its own: everything needed to say yes or no is
 * on this card, so the user never has to scroll back to the plan.
 */
export function GateCard({ step, position, total, onApprove, onSkip, onStop }: GateCardProps) {
  const where = position && total ? ` · step ${position} of ${total}` : '';

  return (
    <section className="gate" aria-live="polite">
      <div className="gate__head">
        <WarningIcon size={13} />
        Waiting for you{where}
      </div>

      <div className="gate__body">
        <div className="gate__intro">
          <h2 className="gate__title">{ACTION_LABELS[step.action]}</h2>
          <p className="gate__lead">Arlo has everything ready and has stopped short of doing it.</p>
        </div>

        <dl className="gate__facts">
          <div className="gate__fact">
            <dt>Step</dt>
            <dd>{step.title}</dd>
          </div>
          {step.target ? (
            <div className="gate__fact">
              <dt>On</dt>
              <dd>{step.target}</dd>
            </div>
          ) : null}
          {step.value ? (
            <div className="gate__fact">
              <dt>Enters</dt>
              <dd>{step.value}</dd>
            </div>
          ) : null}
        </dl>

        <div className="gate__warning">
          <InfoIcon size={14} />
          <span>
            {step.gateDetail ? <span>{step.gateDetail} </span> : null}
            <strong>This cannot be undone.</strong> Arlo waits here until you decide — it will not
            continue on its own.
          </span>
        </div>

        <div className="gate__actions">
          <button
            type="button"
            className="panel-btn panel-btn--lg panel-btn--primary panel-btn--block"
            onClick={onApprove}
          >
            {GATE_APPROVE_LABELS[step.action]}
          </button>
          <div className="panel-btn-row">
            <button
              type="button"
              className="panel-btn panel-btn--sm panel-btn--secondary panel-btn--grow"
              onClick={onSkip}
            >
              Skip this step
            </button>
            <button
              type="button"
              className="panel-btn panel-btn--sm panel-btn--danger panel-btn--grow"
              onClick={onStop}
            >
              Stop task
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
