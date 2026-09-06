import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MessageList } from '../src/sidepanel/components/MessageList';

describe('assistant message rendering', () => {
  it('renders GFM Markdown while leaving raw HTML inert', () => {
    const { container } = render(
      <MessageList
        messages={[
          {
            id: 'assistant-1',
            role: 'assistant',
            at: 0,
            text: `# Status

- first item
- second item

\`\`\`ts
const ready = true;
\`\`\`

| Check | Result |
| --- | --- |
| Markdown | ready |

[OpenAI](https://openai.com/)

<mark data-testid="unsafe-html">raw HTML</mark>`,
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Status' }).tagName).toBe('H1');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'first item',
      'second item',
    ]);
    expect(screen.getByText('const ready = true;').closest('pre')).not.toBeNull();

    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Check');
    expect(table.textContent).toContain('Markdown');
    expect(table.textContent).toContain('ready');

    const link = screen.getByRole('link', { name: 'OpenAI' });
    expect(link.getAttribute('href')).toBe('https://openai.com/');
    expect(container.querySelector('[data-testid="unsafe-html"]')).toBeNull();
  });
});
