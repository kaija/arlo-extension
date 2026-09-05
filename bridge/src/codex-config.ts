/**
 * Maps an Arlo LLM profile onto Codex SDK options.
 *
 * Codex reaches a custom endpoint through a `model_providers` entry rather than
 * a plain base-URL option. That route is used here in preference to the SDK's
 * `baseUrl`/`apiKey` shorthand because it is the only one that lets us name the
 * wire protocol — our profiles carry both OpenAI shapes and they are not
 * interchangeable. The key is passed by *name* (`env_key`), so it travels in
 * the environment and is never written to a config file.
 */

export type LlmApiContract = 'anthropic-messages' | 'openai-responses' | 'openai-chat-completions';

/** The two wire protocols Codex speaks. There is no Anthropic equivalent. */
export type WireApi = 'responses' | 'chat';

export type ConfigValue = string | number | boolean | ConfigValue[] | ConfigObject;
export interface ConfigObject {
  [key: string]: ConfigValue;
}

export interface LlmProfileInput {
  name: string;
  apiContract: LlmApiContract;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ThreadSettings {
  model: string;
  workingDirectory: string;
  skipGitRepoCheck: true;
  sandboxMode: 'workspace-write';
  networkAccessEnabled: false;
  approvalPolicy: 'never';
}

/** Codex refuses these provider ids, so ours must not collide with them. */
export const RESERVED_PROVIDER_IDS = ['openai', 'ollama', 'lmstudio'] as const;

export const PROVIDER_ID = 'arlo';
export const API_KEY_ENV = 'ARLO_MODEL_API_KEY';

export function wireApiFor(contract: LlmApiContract): WireApi {
  switch (contract) {
    case 'openai-responses':
      return 'responses';
    case 'openai-chat-completions':
      return 'chat';
    case 'anthropic-messages':
      throw new Error(
        'Codex speaks the OpenAI responses and chat wire APIs only, so an Anthropic profile cannot drive it. Choose an OpenAI-compatible profile.',
      );
  }
}

function requireField(value: string, message: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) throw new Error(message);
  return trimmed;
}

/**
 * Passing `env` stops the CLI inheriting from `process.env`, so the parent
 * environment is carried across explicitly — Codex needs at least PATH and HOME
 * to find its own binary and its `~/.codex` state.
 */
export function buildEnv(
  apiKey: string,
  parent: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(parent)) {
    if (typeof value === 'string') env[key] = value;
  }
  env[API_KEY_ENV] = apiKey;
  return env;
}

export function buildProviderConfig(profile: LlmProfileInput): ConfigObject {
  // Our profiles already store the API root including the version segment
  // (https://api.openai.com/v1), which is what Codex wants for base_url.
  const baseUrl = requireField(profile.baseUrl, 'This profile has no base URL set.').replace(
    /\/+$/,
    '',
  );
  requireField(profile.apiKey, 'This profile has no API key set.');

  return {
    model_provider: PROVIDER_ID,
    model_providers: {
      [PROVIDER_ID]: {
        name: profile.name.trim() || 'Arlo',
        base_url: baseUrl,
        env_key: API_KEY_ENV,
        wire_api: wireApiFor(profile.apiContract),
      },
    },
  };
}

/**
 * Every session is confined to its own folder: the agent may write inside its
 * working directory and nowhere else, gets no network of its own, and never
 * pauses for an approval because there is no one at the other end to answer.
 */
export function buildThreadSettings(profile: LlmProfileInput, dir: string): ThreadSettings {
  return {
    model: requireField(profile.model, 'This profile has no model set.'),
    workingDirectory: dir,
    skipGitRepoCheck: true,
    sandboxMode: 'workspace-write',
    networkAccessEnabled: false,
    approvalPolicy: 'never',
  };
}
