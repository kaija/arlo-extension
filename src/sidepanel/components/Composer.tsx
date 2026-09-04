import { useState } from 'react';

import { suggestionsForHost } from '../../core/suggestions';
import type { TabInfo } from '../../shared/messages';

interface ComposerProps {
  tab: TabInfo | null;
  disabled: boolean;
  onSubmit: (prompt: string) => void;
}

export function Composer({ tab, disabled, onSubmit }: ComposerProps) {
  const [value, setValue] = useState('');
  const { examples } = suggestionsForHost(tab?.host ?? '');

  const submit = () => {
    const prompt = value.trim();
    if (!prompt || disabled) return;
    onSubmit(prompt);
    setValue('');
  };

  return (
    <section className="composer">
      <p className="composer__context">
        {tab?.host ? (
          <>
            On <strong>{tab.host}</strong>
          </>
        ) : (
          'No active page'
        )}
      </p>

      <ul className="composer__suggestions">
        {examples.map((example) => (
          <li key={example}>
            <button type="button" className="chip" onClick={() => setValue(example)}>
              {example}
            </button>
          </li>
        ))}
      </ul>

      <textarea
        className="composer__input"
        rows={4}
        placeholder="Tell Arlo what to do on this page…"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
        }}
      />
      <button
        type="button"
        className="button button--primary"
        onClick={submit}
        disabled={disabled || !value.trim()}
      >
        Start task
      </button>
    </section>
  );
}
