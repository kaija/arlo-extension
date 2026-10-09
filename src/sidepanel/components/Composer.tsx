import { useEffect, useRef, useState } from 'react';

import { SendIcon, StopIcon } from '../../design-system/icons';

interface ComposerProps {
  placeholder: string;
  disabled?: boolean;
  /** While set, the send button becomes a stop button. */
  onStop?: () => void;
  onSubmit: (prompt: string) => void;
  /** Earlier prompts, oldest first, recalled with the up and down arrows. */
  history?: readonly string[];
}

/**
 * Enter sends, Shift+Enter makes a new line, and Enter while composing with an
 * IME only confirms the candidate. The field grows with its content
 * (`field-sizing`), which is why the send button aligns to the bottom.
 *
 * Up at the first line steps back through earlier prompts and Down steps
 * forward again, ending on whatever was being typed. Editing a recalled
 * prompt makes it the new draft.
 */
export function Composer({
  placeholder,
  disabled = false,
  onStop,
  onSubmit,
  history = [],
}: ComposerProps) {
  const [text, setText] = useState('');
  // Position in `history` while browsing, or null when typing a fresh draft.
  const [cursor, setCursor] = useState<number | null>(null);
  const draft = useRef('');
  const input = useRef<HTMLTextAreaElement>(null);
  const caretToEnd = useRef(false);

  // A recalled prompt should leave the caret after its last character.
  useEffect(() => {
    if (!caretToEnd.current || !input.current) return;
    caretToEnd.current = false;
    const end = input.current.value.length;
    input.current.setSelectionRange(end, end);
  }, [text]);

  const recall = (index: number | null) => {
    setCursor(index);
    setText(index === null ? draft.current : (history[index] ?? ''));
    caretToEnd.current = true;
  };

  const submit = () => {
    const prompt = text.trim();
    if (!prompt || disabled) return;
    onSubmit(prompt);
    setText('');
    setCursor(null);
    draft.current = '';
  };

  const browse = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const field = event.currentTarget;
    if (field.selectionStart !== field.selectionEnd) return;
    if (event.key === 'ArrowUp') {
      // Only from the first line, so the arrow still moves within a multi-line draft.
      if (field.value.slice(0, field.selectionStart).includes('\n')) return;
      if (history.length === 0 || cursor === 0) return;
      event.preventDefault();
      if (cursor === null) draft.current = text;
      recall(cursor === null ? history.length - 1 : cursor - 1);
    } else if (event.key === 'ArrowDown') {
      if (cursor === null || field.value.slice(field.selectionEnd).includes('\n')) return;
      event.preventDefault();
      recall(cursor + 1 < history.length ? cursor + 1 : null);
    }
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
        ref={input}
        onChange={(event) => {
          setText(event.target.value);
          setCursor(null);
        }}
        onKeyDown={(event) => {
          // Enter also confirms an IME candidate (e.g. Zhuyin); that must not send.
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          browse(event);
          if (event.defaultPrevented) return;
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
