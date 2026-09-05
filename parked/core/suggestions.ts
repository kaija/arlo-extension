/**
 * Example tasks shown above the composer. They are derived from the site the
 * user is on, so the empty state makes it obvious Arlo knows where it is.
 */
export interface SiteSuggestions {
  kind: 'shopping' | 'reading' | 'forms' | 'generic';
  examples: string[];
}

const SHOPPING_HINTS = ['shop', 'store', 'cart', 'amazon', 'etsy', 'ebay', 'coffee'];
const READING_HINTS = ['news', 'blog', 'docs', 'wiki', 'medium'];
const FORM_HINTS = ['apply', 'form', 'signup', 'register', 'booking'];

function matches(host: string, hints: string[]): boolean {
  const lower = host.toLowerCase();
  return hints.some((hint) => lower.includes(hint));
}

export function suggestionsForHost(host: string): SiteSuggestions {
  if (matches(host, SHOPPING_HINTS)) {
    return {
      kind: 'shopping',
      examples: [
        'Reorder something from my past orders',
        'Compare the top 3 items on this page',
        'Add the cheapest option in stock to my cart',
      ],
    };
  }
  if (matches(host, FORM_HINTS)) {
    return {
      kind: 'forms',
      examples: [
        'Fill this form with my saved details',
        'Check which required fields are still empty',
        'Find the submission deadline on this site',
      ],
    };
  }
  if (matches(host, READING_HINTS)) {
    return {
      kind: 'reading',
      examples: [
        'Summarise this page for me',
        'Find every link to the pricing page',
        'Open the three most recent posts in tabs',
      ],
    };
  }
  return {
    kind: 'generic',
    examples: [
      'Find the contact details on this site',
      'Fill this form with my saved details',
      'Compare the options on this page',
    ],
  };
}
