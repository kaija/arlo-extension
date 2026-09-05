/**
 * Theme selection. The palette itself lives in design-system/theme-dark.css and
 * hangs off one switch: `data-arlo` on the document element. 'dark' or 'light'
 * force a palette, and no attribute at all means follow the OS. Choosing a
 * theme here is only a matter of setting that attribute — every surface that
 * imports the design system follows.
 */
import { loadSettings, onSettingsChanged } from './settings';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/**
 * The choice is mirrored into localStorage under this key because
 * chrome.storage is async, and a theme applied after the first paint is a
 * flash of the wrong one. public/theme-boot.js reads this key synchronously
 * before the page renders; both must name it the same thing.
 */
export const THEME_BOOT_KEY = 'arlo:theme';

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && THEME_PREFERENCES.includes(value as ThemePreference);
}

export function themeLabel(preference: ThemePreference): string {
  switch (preference) {
    case 'system':
      return 'System';
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
  }
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-arlo');
  else root.setAttribute('data-arlo', preference);
  try {
    localStorage.setItem(THEME_BOOT_KEY, preference);
  } catch {
    // Only the next first paint is affected, and the theme still applies now.
  }
}

/**
 * Applies the stored theme and keeps applying it, so a change made in Settings
 * reaches an open side panel without reopening it.
 */
export function watchTheme(): () => void {
  void loadSettings().then((settings) => applyTheme(settings.theme));
  return onSettingsChanged((settings) => applyTheme(settings.theme));
}
