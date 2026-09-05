// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  API_KEY_ENV,
  PROVIDER_ID,
  RESERVED_PROVIDER_IDS,
  buildEnv,
  buildProviderConfig,
  buildThreadSettings,
  wireApiFor,
  type LlmProfileInput,
} from '../bridge/src/codex-config.ts';

const profile: LlmProfileInput = {
  name: 'Local gateway',
  apiContract: 'openai-chat-completions',
  baseUrl: 'https://gateway.example/v1/',
  apiKey: 'sk-test-key',
  model: 'gpt-5.6-terra',
};

describe('codex config', () => {
  it('refuses to drive Codex with an Anthropic profile', () => {
    // Codex has no Anthropic wire protocol, so this has to fail loudly at the
    // point of configuration rather than as a confusing runtime error.
    expect(() => wireApiFor('anthropic-messages')).toThrow(/Anthropic profile cannot drive it/);
    expect(wireApiFor('openai-responses')).toBe('responses');
    expect(wireApiFor('openai-chat-completions')).toBe('chat');
  });

  it('names the wire protocol the profile actually speaks', () => {
    const config = buildProviderConfig(profile);
    const providers = config.model_providers as Record<string, Record<string, string>>;
    expect(config.model_provider).toBe(PROVIDER_ID);
    expect(providers[PROVIDER_ID]?.wire_api).toBe('chat');
    expect(providers[PROVIDER_ID]?.base_url).toBe('https://gateway.example/v1');
    expect(RESERVED_PROVIDER_IDS).not.toContain(PROVIDER_ID);
  });

  it('passes the key by name, never by value, into the config', () => {
    const config = buildProviderConfig(profile);
    const providers = config.model_providers as Record<string, Record<string, string>>;
    expect(providers[PROVIDER_ID]?.env_key).toBe(API_KEY_ENV);
    expect(JSON.stringify(config)).not.toContain('sk-test-key');
  });

  it('carries the parent environment across, because passing env stops inheritance', () => {
    const env = buildEnv(profile.apiKey, { PATH: '/usr/bin', HOME: '/home/x', EMPTY: undefined });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/home/x');
    expect(env[API_KEY_ENV]).toBe('sk-test-key');
    expect('EMPTY' in env).toBe(false);
  });

  it('confines the agent to the session folder and never waits for an approval', () => {
    const settings = buildThreadSettings(profile, '/tmp/sessions/abc');
    expect(settings).toMatchObject({
      model: 'gpt-5.6-terra',
      workingDirectory: '/tmp/sessions/abc',
      sandboxMode: 'workspace-write',
      networkAccessEnabled: false,
      approvalPolicy: 'never',
      skipGitRepoCheck: true,
    });
  });

  it('names the field that is missing rather than failing at the endpoint', () => {
    expect(() => buildProviderConfig({ ...profile, baseUrl: '  ' })).toThrow(/base URL/);
    expect(() => buildProviderConfig({ ...profile, apiKey: '' })).toThrow(/API key/);
    expect(() => buildThreadSettings({ ...profile, model: '' }, '/tmp')).toThrow(/model/);
  });
});
