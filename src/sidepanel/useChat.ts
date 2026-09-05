import { useCallback, useEffect, useRef, useState } from 'react';

import { emptySession, type ChatMessage, type ChatSession } from '../core/chat';
import { newId } from '../shared/messages';
import {
  bridgeOriginPattern,
  createSession,
  probeBridge,
  requestHostAccess,
  streamTurn,
  type BridgeConfig,
  type BridgeStatus,
} from './bridge-client';
import {
  getDefaultLlmProfile,
  getDefaultLlmProfileSummary,
  loadSettings,
  onSettingsChanged,
  type LlmProfile,
  type LlmProfileSummary,
} from '../shared/settings';

export interface Chat {
  session: ChatSession;
  bridgeUrl: string;
  profile: LlmProfileSummary | null;
  /** Why the bridge is or is not reachable. 'checking' until the first probe. */
  status: BridgeStatus;
  configured: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  reset: () => void;
  dismissError: () => void;
  /** Grant Chrome access to the bridge's host. Must be called from a click. */
  allowAccess: () => Promise<void>;
  recheck: () => void;
}

function message(role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}) {
  return { id: newId('msg'), role, text, at: Date.now(), ...extra };
}

export function useChat(): Chat {
  const [session, setSession] = useState<ChatSession>(emptySession);
  const [profile, setProfile] = useState<LlmProfileSummary | null>(null);
  const [status, setStatus] = useState<BridgeStatus>('checking');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // The bridge config is state, not a ref: `configured` is read during render,
  // and a ref would not re-render the panel when settings change.
  const [config, setConfig] = useState<BridgeConfig>({ url: '', token: '' });
  const full = useRef<LlmProfile | null>(null);

  useEffect(() => {
    let live = true;
    const apply = (settings: Awaited<ReturnType<typeof loadSettings>>) => {
      if (!live) return;
      setConfig({ url: settings.bridgeUrl, token: settings.bridgeToken });
      full.current = getDefaultLlmProfile(settings);
      setProfile(getDefaultLlmProfileSummary(settings));
    };
    void loadSettings().then(apply);
    const stop = onSettingsChanged(apply);
    return () => {
      live = false;
      stop();
    };
  }, []);

  /*
   * Keep probing while the bridge is unreachable. The offline screen tells the
   * reader it will connect on its own, so it has to actually do that — starting
   * the bridge or granting access should be enough, with nothing to click.
   */
  useEffect(() => {
    if (!config.url) return;
    let live = true;
    void probeBridge(config).then((next) => live && setStatus(next));
    return () => {
      live = false;
    };
  }, [config, attempt]);

  useEffect(() => {
    if (status === 'ok' || status === 'checking') return;
    const timer = setInterval(() => setAttempt((n) => n + 1), 4000);
    return () => clearInterval(timer);
  }, [status]);

  const allowAccess = useCallback(async () => {
    const pattern = bridgeOriginPattern(config.url);
    if (!pattern) return;
    await requestHostAccess(pattern);
    setAttempt((n) => n + 1);
  }, [config.url]);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt) return;
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

      try {
        const profileForTurn = full.current;
        if (!profileForTurn) throw new Error('No AI profile is configured.');

        // The session folder is created on first use, so a chat that is never
        // sent leaves nothing behind on disk.
        let id = session.id;
        if (!id) {
          id = await createSession(config);
          setSession((current) => ({ ...current, id }));
        }

        let answer = '';
        await streamTurn(config, id, prompt, profileForTurn, {
          onText: (chunk) => {
            answer = answer ? `${answer}\n\n${chunk}` : chunk;
            replace({ text: answer });
          },
          onError: (reason) => {
            answer = answer ? `${answer}\n\n${reason}` : reason;
            replace({ text: answer, failed: true });
          },
        });

        replace({ streaming: false, ...(answer ? {} : { text: 'The agent returned nothing.' }) });
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        replace({ streaming: false, failed: true, text: reason });
        setError(reason);
      } finally {
        setSession((current) => ({ ...current, running: false }));
      }
    },
    [session.id, config],
  );

  return {
    session,
    bridgeUrl: config.url,
    profile,
    status,
    configured: !!profile,
    error,
    send,
    reset: () => setSession(emptySession),
    dismissError: () => setError(null),
    allowAccess,
    recheck: () => setAttempt((n) => n + 1),
  };
}
