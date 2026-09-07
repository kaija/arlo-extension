/** Domain vocabulary for a chat with the Arlo agent. */

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  at: number;
  /** True while the assistant's reply is still arriving. */
  streaming?: boolean;
  /** Set when the turn ended badly; the text then carries the reason. */
  failed?: boolean;
}

/**
 * One conversation. The agent works in a folder of its own per session, so the
 * session id is also the name of the directory it is confined to.
 */
export interface ChatSession {
  id: string | null;
  messages: ChatMessage[];
  /** True while a turn is in flight. */
  running: boolean;
}

export const emptySession: ChatSession = { id: null, messages: [], running: false };
