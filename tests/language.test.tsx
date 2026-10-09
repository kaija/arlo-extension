import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/shared/settings';
import { IdleScreen } from '../src/sidepanel/components/IdleScreen';
import { Composer } from '../src/sidepanel/components/Composer';
import { LanguageProvider } from '../src/sidepanel/language';
import { LANGUAGES } from '../src/shared/language';
import { panelText } from '../src/sidepanel/text';

describe('language setting', () => {
  it('defaults to English and ignores values it does not know', async () => {
    expect(DEFAULT_SETTINGS.language).toBe('en');
    expect((await loadSettings()).language).toBe('en');
    await chrome.storage.local.set({ 'arlo:settings': { language: 'klingon' } });
    expect((await loadSettings()).language).toBe('en');
  });

  it('keeps the chosen language', async () => {
    await saveSettings({ language: 'zh-TW' });
    expect((await loadSettings()).language).toBe('zh-TW');
  });

  it('has every panel string in every language', () => {
    const english = Object.keys(panelText('en')).sort();
    for (const language of LANGUAGES)
      expect(Object.keys(panelText(language)).sort()).toEqual(english);
  });
});

describe('the panel in another language', () => {
  it('shows English suggestions before any language is chosen', () => {
    render(<IdleScreen busy={false} page={{}} onSubmit={() => {}} />);
    expect(screen.getByText('What should Arlo work on?')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('switches the wording and the suggestions to the saved language', async () => {
    await saveSettings({ language: 'zh-TW' });
    render(
      <LanguageProvider>
        <IdleScreen busy={false} page={{}} onSubmit={() => {}} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('要讓 Arlo 處理什麼？')).toBeTruthy());
    expect(screen.getByText('試試這些')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button.textContent).toMatch(/\p{Script=Han}/u);
  });

  it('follows a language change made on the Settings page', async () => {
    render(
      <LanguageProvider>
        <Composer placeholder="ask" onSubmit={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByLabelText('What should Arlo do?')).toBeTruthy();
    await saveSettings({ language: 'ja' });
    await waitFor(() => expect(screen.getByLabelText('Arlo にしてほしいこと')).toBeTruthy());
  });
});
