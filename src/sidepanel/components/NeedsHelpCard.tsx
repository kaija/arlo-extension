import type { NeedsHelp, PlanStep } from '../../core/types';
import { HandIcon } from '../../design-system/icons';

interface NeedsHelpCardProps {
  needsHelp: NeedsHelp;
  step: PlanStep | null;
  onResume: () => void;
  onStop: () => void;
}

const HEADLINES: Record<NeedsHelp['reason'], string> = {
  element_not_found: 'Arlo is stuck — the page changed',
  sign_in_required: 'Your turn: this page needs a sign-in',
  captcha: 'Your turn: there is a CAPTCHA',
};

const HANDOFFS: Record<NeedsHelp['reason'], string> = {
  element_not_found: 'Do the step yourself in the tab, then let Arlo carry on.',
  sign_in_required: 'Arlo never types credentials. Sign in yourself, then hand it back.',
  captcha: 'Arlo does not solve CAPTCHAs, by design. Solve it, then hand it back.',
};

/**
 * A hand-off, not a failure: the run is intact and waiting, and the card says
 * exactly what the user has to do in the tab before it can carry on.
 */
export function NeedsHelpCard({ needsHelp, step, onResume, onStop }: NeedsHelpCardProps) {
  return (
    <section className="handoff" aria-live="polite">
      <div className="gate__head">
        <HandIcon size={13} />
        Over to you · step {needsHelp.stepIndex + 1}
      </div>

      <div className="handoff__body">
        <div className="gate__intro">
          <h2 className="handoff__title">{HEADLINES[needsHelp.reason]}</h2>
          {step ? <p className="handoff__where">Stopped at: {step.title}</p> : null}
        </div>

        <p className="handoff__text">{needsHelp.message}</p>
        <p className="handoff__text">{HANDOFFS[needsHelp.reason]}</p>

        <div className="gate__actions">
          <button
            type="button"
            className="panel-btn panel-btn--lg panel-btn--primary panel-btn--block"
            onClick={onResume}
          >
            I have done it — continue
          </button>
          <div className="panel-btn-row">
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
