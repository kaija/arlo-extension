import type { ChatMessage } from '../../core/chat';

/**
 * The transcript. An assistant turn appears the moment it is asked for, so the
 * agent's silence while it works is visible rather than looking like nothing
 * happened.
 */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <>
      {messages.map((message) =>
        message.role === 'user' ? (
          <section className="task-message" key={message.id}>
            <p className="task-message__label">
              You ·{' '}
              {new Date(message.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="task-message__text">{message.text}</p>
          </section>
        ) : (
          <section className={`reply${message.failed ? ' reply--failed' : ''}`} key={message.id}>
            {message.text ? <p className="reply__text">{message.text}</p> : null}
            {message.streaming ? (
              <span className="reply__working">
                <span className="planning__spinner" aria-hidden="true" />
                Working…
              </span>
            ) : null}
          </section>
        ),
      )}
    </>
  );
}
