import type { PageSnapshot } from '../../core/page-suggestions';
import { suggestionsForPage } from '../../core/page-suggestions';

export function IdleScreen({
  busy,
  page,
  onSubmit,
}: {
  busy: boolean;
  page: PageSnapshot;
  onSubmit: (prompt: string) => void;
}) {
  const suggestions = suggestionsForPage(page);

  return (
    <div className="idle">
      <div className="idle__intro">
        <h1 className="idle__title">What should Arlo work on?</h1>
        <p className="idle__lead">{suggestions.description}</p>
      </div>

      <div className="suggestions">
        <div className="eyebrow">{suggestions.eyebrow}</div>
        {suggestions.prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="suggestion"
            disabled={busy}
            onClick={() => onSubmit(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
