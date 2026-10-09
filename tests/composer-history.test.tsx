import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Composer } from '../src/sidepanel/components/Composer';

function setup(history: string[] = ['first', 'second', 'third']) {
  const onSubmit = vi.fn();
  render(<Composer placeholder="ask" history={history} onSubmit={onSubmit} />);
  const field = screen.getByLabelText('What should Arlo do?') as HTMLTextAreaElement;
  return { field, onSubmit };
}

const up = (field: HTMLElement) => fireEvent.keyDown(field, { key: 'ArrowUp' });
const down = (field: HTMLElement) => fireEvent.keyDown(field, { key: 'ArrowDown' });

describe('composer history', () => {
  it('steps back through earlier prompts with Up and forward with Down', () => {
    const { field } = setup();
    up(field);
    expect(field.value).toBe('third');
    up(field);
    expect(field.value).toBe('second');
    up(field);
    up(field);
    expect(field.value).toBe('first');
    down(field);
    expect(field.value).toBe('second');
  });

  it('returns to the draft that was being typed when Down passes the newest prompt', () => {
    const { field } = setup();
    fireEvent.change(field, { target: { value: 'half-written' } });
    field.setSelectionRange(0, 0);
    up(field);
    expect(field.value).toBe('third');
    down(field);
    expect(field.value).toBe('half-written');
  });

  it('leaves Up alone below the first line of a multi-line draft', () => {
    const { field } = setup();
    fireEvent.change(field, { target: { value: 'one\ntwo' } });
    field.setSelectionRange(5, 5);
    up(field);
    expect(field.value).toBe('one\ntwo');
  });

  it('does nothing without history, and sends a recalled prompt on Enter', () => {
    const empty = setup([]);
    up(empty.field);
    expect(empty.field.value).toBe('');
    document.body.innerHTML = '';

    const { field, onSubmit } = setup();
    up(field);
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('third');
  });
});
