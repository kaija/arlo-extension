import { useState } from 'react';

import type { PageSnapshot } from '../../core/page-suggestions';
import { pickSuggestions, suggestionsForPage } from '../../core/page-suggestions';
import { useLanguage, useText } from '../language';

/**
 * Three suggestions out of a larger pool, drawn once each time the screen
 * appears — a new task, a new language, or a different kind of page — rather
 * than on every render, so they do not shuffle while you read them.
 */
export function IdleScreen({
  busy,
  page,
  onSubmit,
}: {
  busy: boolean;
  page: PageSnapshot;
  onSubmit: (prompt: string) => void;
}) {
  const language = useLanguage();
  const suggestions = suggestionsForPage(page, language);

  return (
    <IdleContent
      key={`${suggestions.id}:${language}`}
      suggestions={suggestions}
      busy={busy}
      onSubmit={onSubmit}
    />
  );
}

function IdleContent({
  suggestions,
  busy,
  onSubmit,
}: {
  suggestions: ReturnType<typeof suggestionsForPage>;
  busy: boolean;
  onSubmit: (prompt: string) => void;
}) {
  const text = useText();
  const [prompts] = useState(() => pickSuggestions(suggestions.pool));

  return (
    <div className="idle">
      <div className="idle__intro">
        <h1 className="idle__title">{text.idleTitle}</h1>
        <p className="idle__lead">{suggestions.description}</p>
      </div>

      <div className="suggestions">
        <div className="eyebrow">{suggestions.eyebrow}</div>
        {prompts.map((prompt) => (
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
