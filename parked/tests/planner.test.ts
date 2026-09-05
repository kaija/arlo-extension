import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlanner } from '../src/background/planner';
import {
  DEFAULT_SETTINGS,
  createLlmProfile,
  profileOrigin,
  type Settings,
} from '../src/shared/settings';

const fetchMock = vi.fn();

function configuredSettings(): Settings {
  const created = {
    ...createLlmProfile('openai-chat-completions'),
    model: 'test-model',
    apiKey: 'test-secret',
  };
  const profile = { ...created, dataOriginAcknowledged: profileOrigin(created) };
  return { ...DEFAULT_SETTINGS, llmProfiles: [profile], defaultLlmProfileId: profile.id };
}

describe('model-backed planner', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('requires a configured default profile', () => {
    expect(() => createPlanner(DEFAULT_SETTINGS)).toThrow('default AI connection');
  });

  it('converts a model tool call into a gated executable plan', async () => {
    const toolPlan = {
      steps: [
        { title: 'Read the total', action: 'read' },
        {
          title: 'Place the order',
          action: 'purchase',
          target: '#place-order',
          gateDetail: 'This charges the saved payment method.',
        },
      ],
    };
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  { function: { name: 'submit_plan', arguments: JSON.stringify(toolPlan) } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const plan = await createPlanner(configuredSettings()).createPlan(
      'Buy the item',
      { url: 'https://shop.example', title: 'Shop', text: 'Place order' },
      'task_1',
    );

    expect(plan.taskId).toBe('task_1');
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0]?.requiresApproval).toBe(false);
    expect(plan.steps[1]).toMatchObject({
      action: 'purchase',
      target: '#place-order',
      requiresApproval: true,
    });
  });
});
