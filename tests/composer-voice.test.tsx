import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLlmProfile } from '../src/shared/settings';
import { Composer } from '../src/sidepanel/components/Composer';
import type { DictationHandlers } from '../src/sidepanel/voice';

const started = vi.hoisted(() => ({
  handlers: null as DictationHandlers | null,
  stop: vi.fn(),
  cancel: vi.fn(),
  reject: null as Error | null,
}));

vi.mock('../src/sidepanel/voice', () => ({
  startDictation: vi.fn(async (_profile: unknown, handlers: DictationHandlers) => {
    if (started.reject) throw started.reject;
    started.handlers = handlers;
    return { stop: started.stop, cancel: started.cancel };
  }),
}));

const profile = {
  ...createLlmProfile('openai-responses'),
  voiceModel: 'gpt-4o-transcribe',
};

beforeEach(() => {
  started.handlers = null;
  started.reject = null;
});

function setup(autoSend = false) {
  const onSubmit = vi.fn();
  render(<Composer placeholder="ask" voice={{ profile, autoSend }} onSubmit={onSubmit} />);
  const field = screen.getByLabelText('What should Arlo do?') as HTMLTextAreaElement;
  return { field, onSubmit };
}

describe('composer voice', () => {
  it('has no microphone button without a voice profile', () => {
    render(<Composer placeholder="ask" onSubmit={vi.fn()} />);
    expect(screen.queryByTitle('Speak')).toBeNull();
  });

  it('fills the field as words arrive, after what was already typed', async () => {
    const { field } = setup();
    fireEvent.change(field, { target: { value: 'please' } });
    fireEvent.click(screen.getByTitle('Speak'));
    await screen.findByTitle('Stop dictation');
    started.handlers?.onText('open the');
    await waitFor(() => expect(field.value).toBe('please open the'));
    fireEvent.click(screen.getByTitle('Stop dictation'));
    expect(started.stop).toHaveBeenCalled();
    started.handlers?.onDone('open the docs');
    await waitFor(() => expect(field.value).toBe('please open the docs'));
  });

  it('sends the transcript itself when auto-send is on', async () => {
    const { field, onSubmit } = setup(true);
    fireEvent.click(screen.getByTitle('Speak'));
    await screen.findByTitle('Stop dictation');
    started.handlers?.onDone('summarize this page');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('summarize this page'));
    expect(field.value).toBe('');
  });

  it('shows why the microphone could not start', async () => {
    started.reject = new Error('No microphone was found.');
    setup();
    fireEvent.click(screen.getByTitle('Speak'));
    expect((await screen.findByRole('alert')).textContent).toBe('No microphone was found.');
  });

  it('closes the microphone when a run starts, and is idle again after it', async () => {
    const onSubmit = vi.fn();
    const props = { placeholder: 'ask', voice: { profile, autoSend: false }, onSubmit };
    const { rerender } = render(<Composer {...props} />);
    fireEvent.click(screen.getByTitle('Speak'));
    await screen.findByTitle('Stop dictation');

    // Enter sent the message while the microphone was still open.
    rerender(<Composer {...props} disabled />);
    expect(started.cancel).toHaveBeenCalled();
    rerender(<Composer {...props} />);

    expect(screen.getByTitle('Speak')).toBeTruthy();
    expect(screen.queryByTitle('Stop dictation')).toBeNull();
  });
});
