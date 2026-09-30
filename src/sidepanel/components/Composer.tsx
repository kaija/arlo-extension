import { useState } from 'react';

import { SendIcon, StopIcon } from '../../design-system/icons';

interface ComposerProps {
  placeholder: string;
  disabled?: boolean;
  /** While set, the send button becomes a stop button. */
  onStop?: () => void;
  onSubmit: (prompt: string) => void;
}

/**
 * Enter sends, Shift+Enter makes a new line, and Enter while composing with an
 * IME only confirms the candidate. The field grows with its content
 * (`field-sizing`), which is why the send button aligns to the bottom.
 */
export function Composer({ placeholder, disabled = false, onStop, onSubmit }: ComposerProps) {
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
          // Enter also confirms an IME candidate (e.g. Zhuyin); that must not send.
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {onStop ? (
        <button type="button" className="composer__send" onClick={onStop} title="Stop">
          <StopIcon size={14} />
          <span className="visually-hidden">Stop</span>
        </button>
      ) : (
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
      )}
    </div>
  );
}
