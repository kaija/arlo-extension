import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { emptySession, type ChatMessage, type ChatSession } from '../core/chat';
import { newId } from '../shared/messages';
import { hasHostAccess, originPattern, requestHostAccess } from '../shared/model-access';
import {
  getDefaultLlmProfile,
  getDefaultLlmProfileSummary,
  loadSettings,
  onSettingsChanged,
  type LlmProfile,
  type LlmProfileSummary,
} from '../shared/settings';
import { runLocalTurn, type AgentMessageUpdate, type LocalAgentHistory } from './local-agent';

/**
 * Whether a turn can start at all, and if not, why — each answer gets its own
 * screen, because "it does not work" is not something anyone can act on.
 */
export type ChatStatus =
  | 'checking'
  | 'ready'
  /** No default profile, or one that is not filled in. */
  | 'unconfigured'
  /** Chrome has not been given access to the profile's own origin. */
  | 'no-model-access'
  /** The profile's Base URL is not something Chrome can be asked for. */
  | 'bad-endpoint';

export interface Chat {
  session: ChatSession;
  profile: LlmProfileSummary | null;
  status: ChatStatus;
  /** The origin the panel needs, shown on the access screen. */
  endpoint: string;
  configured: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  reset: () => void;
  dismissError: () => void;
  /** Grant Chrome access to the model's origin. Must be called from a click. */
  allowAccess: () => Promise<void>;
  recheck: () => void;
}

function message(role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}) {
  return { id: newId('msg'), role, text, at: Date.now(), ...extra };
}

export function useChat(): Chat {
  const [session, setSession] = useState<ChatSession>(emptySession);
  const [profile, setProfile] = useState<LlmProfileSummary | null>(null);
  // Keyed by the pattern it answered for, so a profile change cannot be read
  // as a grant that was made for the previous endpoint.
  const [access, setAccess] = useState<{ pattern: string; granted: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Read during render, so state rather than a ref: a ref would not re-render
  // the panel when settings change somewhere else.
  const [endpoint, setEndpoint] = useState('');
  const full = useRef<LlmProfile | null>(null);
  // One conversation, carried across turns.
  const history = useRef<LocalAgentHistory>([]);
  const activeTurn = useRef<AbortController | null>(null);
  useEffect(() => () => activeTurn.current?.abort(), []);

  useEffect(() => {
    let live = true;
    const apply = (settings: Awaited<ReturnType<typeof loadSettings>>) => {
      if (!live) return;
      const next = getDefaultLlmProfile(settings);
      full.current = next;
      setEndpoint(next?.baseUrl ?? '');
      setProfile(getDefaultLlmProfileSummary(settings));
    };
    void loadSettings().then(apply);
    const stop = onSettingsChanged(apply);
    return () => {
      live = false;
      stop();
    };
  }, []);

  const pattern = useMemo(() => (endpoint ? originPattern(endpoint) : null), [endpoint]);

  /*
   * The panel calls the model itself, so Chrome must have granted the profile's
   * own origin. Re-checked whenever the profile changes, and after a grant.
   */
  useEffect(() => {
    if (!pattern) return;
    let live = true;
    void hasHostAccess(pattern).then((granted) => live && setAccess({ pattern, granted }));
    return () => {
      live = false;
    };
  }, [pattern, attempt]);

  // Derived, not stored: setting state from inside the effect above would make
  // every profile change a second render pass.
  const status: ChatStatus = !endpoint
    ? 'unconfigured'
    : !pattern
      ? 'bad-endpoint'
      : access?.pattern !== pattern
        ? 'checking'
        : access.granted
          ? 'ready'
          : 'no-model-access';

  const allowAccess = useCallback(async () => {
    if (!pattern) return;
    await requestHostAccess(pattern);
    setAttempt((n) => n + 1);
  }, [pattern]);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || activeTurn.current || status !== 'ready') return;
      const controller = new AbortController();
      activeTurn.current = controller;
      setError(null);

      const pending = message('assistant', '', { streaming: true });
      setSession((current) => ({
        ...current,
        running: true,
        messages: [...current.messages, message('user', prompt), pending],
      }));

      const replace = (patch: Partial<ChatMessage>) =>
        setSession((current) => ({
          ...current,
          messages: current.messages.map((m) => (m.id === pending.id ? { ...m, ...patch } : m)),
        }));

      let answer = '';
      let failed = false;

      try {
        const profileForTurn = full.current;
        if (!profileForTurn) throw new Error('No AI profile is configured.');
        // getCurrent belongs to this panel, unlike the last focused window,
        // which can change while the agent is thinking.
        const window = await chrome.windows.getCurrent();
        controller.signal.throwIfAborted();
        if (window.id === undefined) throw new Error('The Arlo browser window is unavailable.');

        const outcome = await runLocalTurn(
          profileForTurn,
          window.id,
          prompt,
          history.current,
          {
            onText: (update: AgentMessageUpdate) => {
              answer = update.text;
              replace({ text: answer });
            },
            onError: (reason) => {
              failed = true;
              answer = answer ? `${answer}\n\n${reason}` : reason;
              replace({ text: answer, failed: true });
            },
          },
          controller.signal,
        );
        history.current = outcome.history;
        replace({
          streaming: false,
          ...(failed ? { failed: true } : {}),
          text: answer || 'The agent returned nothing.',
        });
      } catch (cause) {
        if (controller.signal.aborted) return;
        const reason = cause instanceof Error ? cause.message : String(cause);
        replace({ streaming: false, failed: true, text: reason });
        setError(reason);
      } finally {
        if (activeTurn.current === controller) activeTurn.current = null;
        setSession((current) => ({ ...current, running: false }));
      }
    },
    [status],
  );

  return {
    session,
    profile,
    status,
    endpoint,
    configured: !!profile,
    error,
    send,
    reset: () => {
      activeTurn.current?.abort();
      history.current = [];
      setSession(emptySession);
      setError(null);
    },
    dismissError: () => setError(null),
    allowAccess,
    recheck: () => setAttempt((n) => n + 1),
  };
}
