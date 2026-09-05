export interface PageSnapshot {
  url?: string;
  title?: string;
}

export interface PageSuggestions {
  id: string;
  eyebrow: string;
  description: string;
  prompts: readonly [string, string, string];
}

interface SuggestionRule {
  suggestions: PageSuggestions;
  matches: (page: PageSnapshot) => boolean;
}

const DEFAULT_SUGGESTIONS: PageSuggestions = {
  id: 'default',
  eyebrow: 'Try one of these',
  description:
    'Arlo can help with the page you’re viewing. It asks before submitting forms, sending messages, deleting data, or changing account settings.',
  prompts: [
    'Summarize this page and highlight what needs my attention',
    'Find the information I need on this page',
    'Help me complete the task on this page, and ask before taking sensitive actions',
  ],
};

const GMAIL_HOME_SUGGESTIONS: PageSuggestions = {
  id: 'gmail-home',
  eyebrow: 'Suggestions for Gmail',
  description:
    'Arlo can help organize email work on this page. It asks before sending messages or making other sensitive changes.',
  prompts: [
    'Summarize important unread emails and flag anything urgent',
    'Find messages that need a reply today',
    'Draft replies to the most important emails, but ask before sending',
  ],
};

function isGmailHome(page: PageSnapshot): boolean {
  if (!page.url) return false;
  try {
    const url = new URL(page.url);
    if (url.hostname !== 'mail.google.com' || !url.pathname.startsWith('/mail')) return false;
    return url.hash === '' || url.hash === '#inbox';
  } catch {
    return false;
  }
}

const RULES: readonly SuggestionRule[] = [
  {
    suggestions: GMAIL_HOME_SUGGESTIONS,
    matches: isGmailHome,
  },
];

/** Returns the first page-specific suggestion set, or the safe generic fallback. */
export function suggestionsForPage(page: PageSnapshot): PageSuggestions {
  return RULES.find((rule) => rule.matches(page))?.suggestions ?? DEFAULT_SUGGESTIONS;
}
