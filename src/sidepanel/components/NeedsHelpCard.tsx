import type { NeedsHelp, PlanStep } from '../../core/types';

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

export function NeedsHelpCard({ needsHelp, step, onResume, onStop }: NeedsHelpCardProps) {
  return (
    <section className="card card--help">
      <header className="card__header">
        <h2 className="card__title">{HEADLINES[needsHelp.reason]}</h2>
        <span className="badge badge--help">Over to you</span>
      </header>

      {step ? (
        <p className="card__note">
          Stopped at step {needsHelp.stepIndex + 1}: {step.title}
        </p>
      ) : null}
      <p className="help__message">{needsHelp.message}</p>
      <p className="help__handoff">{HANDOFFS[needsHelp.reason]}</p>

      <div className="actions">
        <button type="button" className="button button--primary" onClick={onResume}>
          I have done it — continue
        </button>
        <button type="button" className="button button--danger" onClick={onStop}>
          Stop task
        </button>
      </div>
    </section>
  );
}
