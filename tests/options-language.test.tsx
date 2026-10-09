import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Options } from '../src/options/Options';
import { optionsText } from '../src/options/text';
import { LANGUAGES } from '../src/shared/language';
import { createLlmProfile, saveSettings } from '../src/shared/settings';

describe('Settings page text', () => {
  it('has every string in every language', () => {
    const english = optionsText('en');
    for (const language of LANGUAGES) {
      const text = optionsText(language);
      expect(Object.keys(text).sort()).toEqual(Object.keys(english).sort());
      expect(Object.keys(text.profileError).sort()).toEqual(
        Object.keys(english.profileError).sort(),
      );
      expect(Object.keys(text.discovery).sort()).toEqual(Object.keys(english.discovery).sort());
    }
  });

  it('keeps Traditional Chinese out of Simplified', () => {
    const everything = JSON.stringify(
      Object.values(optionsText('zh-TW')).map((value) =>
        typeof value === 'function'
          ? (value as (...args: unknown[]) => unknown)('x', 'y', 2)
          : value,
      ),
    );
    expect(everything).not.toMatch(/[设这个们务对说发页项选载]/);
  });

  it('fills in counts and names', () => {
    expect(optionsText('en').modelsLoaded(1)).toBe('Loaded 1 model.');
    expect(optionsText('zh-TW').modelsLoaded(3)).toBe('已載入 3 個模型。');
    expect(optionsText('ja').deleteTitle('Work')).toBe('「Work」を削除しますか？');
  });
});

describe('Settings page', () => {
  it('is in English by default', async () => {
    render(<Options />);
    expect(await screen.findByRole('heading', { name: 'Appearance' })).toBeTruthy();
    expect(screen.getByText('AI connections')).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
  });

  it.each([
    ['zh-TW', '外觀', 'AI 連線', '新增設定檔'],
    ['ja', '外観', 'AI 接続', 'プロファイルを追加'],
  ] as const)(
    'speaks %s once that language is saved',
    async (language, appearance, connections, add) => {
      const profile = createLlmProfile('openai-responses');
      await saveSettings({ language, llmProfiles: [profile], defaultLlmProfileId: profile.id });
      render(<Options />);
      expect(await screen.findByRole('heading', { name: appearance })).toBeTruthy();
      expect(screen.getByText(connections)).toBeTruthy();
      expect(screen.getByText(add)).toBeTruthy();
      await waitFor(() => expect(document.documentElement.lang).toBe(language));
      // None of the English labels is left behind.
      expect(screen.queryByText('Appearance')).toBeNull();
      expect(screen.queryByText('Add profile')).toBeNull();
      expect(screen.queryByText('Save profile')).toBeNull();
    },
  );
});
