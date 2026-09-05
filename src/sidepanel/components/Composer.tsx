import { useState } from 'react';

import { SendIcon } from '../../design-system/icons';

interface ComposerProps {
  placeholder: string;
  disabled?: boolean;
  onSubmit: (prompt: string) => void;
}

/**
 * Enter sends, Shift+Enter makes a new line. The field grows with its content
 * (`field-sizing`), which is why the send button aligns to the bottom.
 */
export function Composer({ placeholder, disabled = false, onSubmit }: ComposerProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const prompt = text.trim();
    if (!prompt || disabled) return;
    onSubmit(prompt);
    setText('');
  };

  return (
    <div className="composer">
      <textarea
        className="composer__input"
        rows={1}
        placeholder={placeholder}
        aria-label="What should Arlo do?"
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="button"
        className="composer__send"
        onClick={submit}
        disabled={disabled || !text.trim()}
        title="Send"
      >
        <SendIcon size={15} />
        <span className="visually-hidden">Send</span>
      </button>
    </div>
  );
}
