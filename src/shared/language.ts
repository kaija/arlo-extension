/** The languages the side panel can speak. The first is the default. */
export const LANGUAGES = ['en', 'zh-TW', 'ja'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && LANGUAGES.includes(value as Language);
}

/** Each language in its own name, so it can be found whatever the panel currently says. */
export function languageLabel(language: Language): string {
  switch (language) {
    case 'en':
      return 'English';
    case 'zh-TW':
      return '繁體中文';
    case 'ja':
      return '日本語';
  }
}

/** The name the agent is told to reply in. */
export function languageName(language: Language): string {
  switch (language) {
    case 'en':
      return 'English';
    case 'zh-TW':
      return 'Traditional Chinese (繁體中文, Taiwan usage — never Simplified)';
    case 'ja':
      return 'Japanese (日本語)';
  }
}
