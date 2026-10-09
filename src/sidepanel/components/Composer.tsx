import { useEffect, useRef, useState } from 'react';

import { MicIcon, SendIcon, StopIcon } from '../../design-system/icons';
import type { LlmProfile } from '../../shared/settings';
import { startDictation, type Dictation } from '../voice';

/** Turns the profile's voice model into a microphone button. */
export interface ComposerVoice {
  profile: LlmProfile;
  /** Send straight away once the words are transcribed. */
  autoSend: boolean;
}

type VoiceState = 'idle' | 'starting' | 'listening' | 'processing';

interface ComposerProps {
  placeholder: string;
  disabled?: boolean;
  /** While set, the send button becomes a stop button. */
  onStop?: () => void;
  onSubmit: (prompt: string) => void;
  /** Earlier prompts, oldest first, recalled with the up and down arrows. */
  history?: readonly string[];
  /** When set, a microphone button dictates into the field. */
  voice?: ComposerVoice;
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
  voice,
}: ComposerProps) {
  const [text, setText] = useState('');
  // Position in `history` while browsing, or null when typing a fresh draft.
  const [cursor, setCursor] = useState<number | null>(null);
  const draft = useRef('');
  const input = useRef<HTMLTextAreaElement>(null);
  const caretToEnd = useRef(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const dictation = useRef<Dictation | null>(null);
  // Bumped on every start and cancel, so a microphone that finishes opening
  // after the user changed their mind can be closed again.
  const attempt = useRef(0);
  // A profile change or a run starting must not leave the microphone open, so
  // the state belongs to the key it was started under and reads as idle once
  // that key no longer matches.
  const voiceKey = voice && !disabled ? `${voice.profile.id}:${voice.profile.voiceMode}` : '';
  const [voiceSession, setVoiceSession] = useState<{ key: string; state: VoiceState }>({
    key: '',
    state: 'idle',
  });
  const voiceState: VoiceState = voiceSession.key === voiceKey ? voiceSession.state : 'idle';
  const setVoiceState = (state: VoiceState) => setVoiceSession({ key: voiceKey, state });
  // Read when a transcript arrives, which can be long after the click.
  const latest = useRef({ autoSend: false, submit: (_value: string) => {} });

  useEffect(
    () => () => {
      dictation.current?.cancel();
      dictation.current = null;
      // Otherwise "listening" would come back with the key once a run ends.
      setVoiceSession({ key: '', state: 'idle' });
    },
    [voiceKey],
  );

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

  const submit = (value = text) => {
    const prompt = value.trim();
    if (!prompt || disabled) return;
    onSubmit(prompt);
    setText('');
    setCursor(null);
    draft.current = '';
  };
  useEffect(() => {
    latest.current = { autoSend: !!voice?.autoSend, submit };
  });

  const toggleVoice = async () => {
    if (!voice) return;
    if (voiceState === 'listening' && dictation.current) {
      dictation.current.stop();
      return;
    }
    if (voiceState !== 'idle') {
      // Starting or transcribing: the only useful thing a click can mean is "never mind".
      attempt.current += 1;
      dictation.current?.cancel();
      dictation.current = null;
      setVoiceState('idle');
      return;
    }
    const mine = (attempt.current += 1);
    setVoiceError(null);
    setVoiceState('starting');
    // Speech is added after whatever is already typed.
    const base = text && !/\s$/.test(text) ? `${text} ` : text;
    setCursor(null);
    try {
      const started = await startDictation(voice.profile, {
        onText: (spoken) => setText(base + spoken),
        onProcessing: () => setVoiceState('processing'),
        onDone: (spoken) => {
          dictation.current = null;
          setVoiceState('idle');
          const full = base + spoken;
          if (spoken && latest.current.autoSend) {
            latest.current.submit(full);
          } else {
            setText(full);
            caretToEnd.current = true;
            input.current?.focus();
          }
        },
        onError: (message) => {
          dictation.current = null;
          setVoiceState('idle');
          setVoiceError(message);
        },
      });
      if (attempt.current !== mine) {
        started.cancel();
        return;
      }
      dictation.current = started;
      // Only if nothing (a stop, a cancel) happened while the microphone was opening.
      setVoiceSession((current) =>
        current.key === voiceKey && current.state === 'starting'
          ? { key: voiceKey, state: 'listening' }
          : current,
      );
    } catch (cause) {
      dictation.current = null;
      setVoiceState('idle');
      setVoiceError(cause instanceof Error ? cause.message : String(cause));
    }
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

  const listening = voiceState === 'listening';
  const voiceLabel =
    voiceState === 'listening'
      ? 'Stop dictation'
      : voiceState === 'idle'
        ? 'Speak'
        : 'Cancel dictation';

  return (
    <>
      {voiceError ? (
        <p className="composer-note composer-note--error" role="alert">
          {voiceError}
        </p>
      ) : null}
      <div className="composer">
        <textarea
          className="composer__input"
          rows={1}
          placeholder={listening ? 'Listening…' : placeholder}
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
        {voice ? (
          <button
            type="button"
            className={`composer__mic${listening ? ' composer__mic--live' : ''}`}
            onClick={() => void toggleVoice()}
            disabled={disabled}
            aria-pressed={listening}
            title={voiceLabel}
          >
            {voiceState === 'starting' || voiceState === 'processing' ? (
              <span className="spinner spinner-sm" />
            ) : (
              <MicIcon size={15} />
            )}
            <span className="visually-hidden">{voiceLabel}</span>
          </button>
        ) : null}
        {onStop ? (
          <button type="button" className="composer__send" onClick={onStop} title="Stop">
            <StopIcon size={14} />
            <span className="visually-hidden">Stop</span>
          </button>
        ) : (
          <button
            type="button"
            className="composer__send"
            onClick={() => submit()}
            disabled={disabled || !text.trim()}
            title="Send"
          >
            <SendIcon size={15} />
            <span className="visually-hidden">Send</span>
          </button>
        )}
      </div>
    </>
  );
}
