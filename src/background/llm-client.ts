import type { LlmDiagnostic, ModelDiscoveryResult } from '../shared/messages';
import { profileModelsEndpoint, type LlmProfile } from '../shared/settings';

const ANTHROPIC_VERSION = '2023-06-01';
type UnknownRecord = Record<string, unknown>;

export class LlmRequestError extends Error {
  readonly diagnostic: LlmDiagnostic;

  constructor(message: string, diagnostic: LlmDiagnostic) {
    super(message);
    this.name = 'LlmRequestError';
    this.diagnostic = diagnostic;
  }
}

export function publicLlmError(cause: unknown): { error: string; diagnostic?: LlmDiagnostic } {
  if (cause instanceof LlmRequestError) {
    return { error: cause.message, diagnostic: cause.diagnostic };
  }
  return { error: cause instanceof Error ? cause.message : String(cause) };
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function authHeaders(profile: LlmProfile): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (profile.apiContract === 'anthropic-messages') {
    headers['anthropic-version'] = ANTHROPIC_VERSION;
    if (profile.apiKey) headers['x-api-key'] = profile.apiKey;
  } else if (profile.apiKey) {
    headers.Authorization = `Bearer ${profile.apiKey}`;
  }
  return headers;
}

function requestId(response: Response): string | undefined {
  return (
    response.headers.get('request-id') ??
    response.headers.get('x-request-id') ??
    response.headers.get('openai-request-id') ??
    undefined
  );
}

function sanitizedExcerpt(text: string, apiKey: string): string | undefined {
  const withoutExactKey = apiKey ? text.split(apiKey).join('[redacted]') : text;
  const compact = withoutExactKey.replace(/\s+/g, ' ').trim();
  if (!compact) return undefined;
  return compact
    .replace(/\b(sk|key|token)-[A-Za-z0-9_-]{8,}\b/gi, '[redacted]')
    .replace(/("?(?:api[_-]?key|authorization|token)"?\s*[:=]\s*")([^"]+)(")/gi, '$1[redacted]$3')
    .slice(0, 600);
}

function providerMessage(body: unknown, fallback: string): string {
  const record = asRecord(body);
  const error = asRecord(record?.error);
  if (typeof error?.message === 'string') return error.message;
  if (typeof record?.message === 'string') return record.message;
  return fallback;
}

async function requestJson(
  profile: LlmProfile,
  endpoint: string,
  init: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(endpoint, init);
  } catch {
    throw new LlmRequestError(
      `Could not reach ${new URL(endpoint).origin}. Check the Base URL and network connection.`,
      { endpoint, apiContract: profile.apiContract },
    );
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const fallback = `The model endpoint returned HTTP ${response.status}.`;
    throw new LlmRequestError(providerMessage(body, fallback), {
      endpoint,
      apiContract: profile.apiContract,
      status: response.status,
      ...(requestId(response) ? { requestId: requestId(response) } : {}),
      ...(sanitizedExcerpt(text, profile.apiKey)
        ? { responseExcerpt: sanitizedExcerpt(text, profile.apiKey) }
        : {}),
    });
  }
  return body;
}

function modelIds(body: unknown): string[] {
  const record = asRecord(body);
  const candidates = Array.isArray(record?.data)
    ? record.data
    : Array.isArray(record?.models)
      ? record.models
      : Array.isArray(body)
        ? body
        : [];
  return [
    ...new Set(
      candidates
        .map((value) => {
          if (typeof value === 'string') return value;
          const item = asRecord(value);
          return typeof item?.id === 'string' ? item.id : null;
        })
        .filter((value): value is string => !!value),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export async function listModels(profile: LlmProfile): Promise<ModelDiscoveryResult> {
  const endpoint = profileModelsEndpoint(profile);
  const checkedAt = Date.now();
  try {
    const body = await requestJson(profile, endpoint, {
      method: 'GET',
      headers: authHeaders(profile),
    });
    const models = modelIds(body);
    return {
      status: 'available',
      models,
      checkedAt,
      message:
        models.length === 1
          ? 'Loaded 1 model.'
          : `Loaded ${models.length.toLocaleString()} models.`,
    };
  } catch (cause) {
    if (cause instanceof LlmRequestError) {
      const unavailable = [404, 405, 501].includes(cause.diagnostic.status ?? 0);
      return {
        status: unavailable ? 'unavailable' : 'failed',
        models: [],
        checkedAt,
        message: unavailable
          ? 'Model list unavailable. You can still enter a model ID manually.'
          : cause.message,
        diagnostic: cause.diagnostic,
      };
    }
    throw cause;
  }
}
