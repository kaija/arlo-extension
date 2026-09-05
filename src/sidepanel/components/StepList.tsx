import type { RunState } from '../../core/types';
import { stepMark, stepTone } from '../run-presentation';

/**
 * The expanded run list. Four states are visible at once by design — what is
 * done, what is happening, what will stop for a decision, and what is still
 * ahead — so the user can judge whether to intervene without scrolling.
 */
export function StepList({ state }: { state: RunState }) {
  const steps = state.plan?.steps ?? [];

  return (
    <ol className="steps">
      {steps.map((step, index) => {
        const tone = stepTone(state, index);
        return (
          <li className={`step step--${tone}`} key={step.id}>
            <span className="step__mark" aria-hidden="true">
              {stepMark(tone, index)}
            </span>
            <div className="step__body">
              <p className="step__title">{step.title}</p>
              {tone === 'done' && step.result ? (
                <p className="step__result">{step.result}</p>
              ) : null}
              {step.error ? <p className="step__error">{step.error}</p> : null}
              {step.requiresApproval && tone !== 'done' && tone !== 'skipped' ? (
                <span className="step__flag">
                  {tone === 'gate' ? 'Needs your OK now' : 'Will stop for your OK'}
                </span>
              ) : null}
            </div>
            <span className="visually-hidden">{tone}</span>
          </li>
        );
      })}
    </ol>
  );
}
