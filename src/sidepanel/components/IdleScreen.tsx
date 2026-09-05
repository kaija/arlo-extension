import { suggestionsForHost } from '../../core/suggestions';
import type { TabInfo } from '../../shared/messages';

interface IdleScreenProps {
  tab: TabInfo | null;
  busy: boolean;
  onSubmit: (prompt: string) => void;
}

/**
 * The empty state has to answer "what can this thing do here?", so the examples
 * are drawn from the site the user is actually on. The composer is not here —
 * it lives in the dock, in the same place in every state.
 */
export function IdleScreen({ tab, busy, onSubmit }: IdleScreenProps) {
  const { examples } = suggestionsForHost(tab?.host ?? '');

  return (
    <div className="idle">
      <div className="idle__intro">
        <h1 className="idle__title">What should Arlo do here?</h1>
        <p className="idle__lead">
          Describe a task in plain words. Arlo shows you a plan before it touches anything.
        </p>
      </div>

      <div className="suggestions">
        <div className="eyebrow">{tab?.host ? `Try on ${tab.host}` : 'Try one of these'}</div>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            className="suggestion"
            disabled={busy}
            onClick={() => onSubmit(example)}
          >
            {example}
          </button>
        ))}
      </div>

      <p className="idle__footnote">
        Arlo pauses before anything it can’t undo — orders, messages, sign-ins, deletions.
      </p>
    </div>
  );
}
