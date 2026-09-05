/*
 * PARKED — the planner half of tests/llm-client.test.ts.
 *
 * Covers requestPlan, which now lives in parked/background/llm-planning.ts.
 * Restore both together; this needs the `profile` and `page` fixtures and the
 * fetch mock from the top of the original file.
 */
describe('planner requests', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  const plan = { steps: [{ title: 'Read the page', action: 'read' }] };
  const page = { url: 'https://example.com', title: 'Example', text: 'Visible text' };

  it('extracts an Anthropic tool call', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: 'tool_use', name: 'submit_plan', input: plan }] }),
    );
    await expect(requestPlan(profile('anthropic-messages'), 'Summarize it', page)).resolves.toEqual(
      plan,
    );
  });

  it('extracts an OpenAI Responses function call and disables storage', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        output: [{ type: 'function_call', name: 'submit_plan', arguments: JSON.stringify(plan) }],
      }),
    );
    await expect(requestPlan(profile('openai-responses'), 'Summarize it', page)).resolves.toEqual(
      plan,
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ store: false, model: 'test-model' });
  });

  it('extracts an OpenAI Chat Completions function call', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              tool_calls: [{ function: { name: 'submit_plan', arguments: JSON.stringify(plan) } }],
            },
          },
        ],
      }),
    );
    await expect(
      requestPlan(profile('openai-chat-completions'), 'Summarize it', page),
    ).resolves.toEqual(plan);
  });
});
