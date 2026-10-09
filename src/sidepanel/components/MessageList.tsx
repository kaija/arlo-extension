import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { ChatMessage } from '../../core/chat';
import { useLanguage, useText } from '../language';

/**
 * The transcript. An assistant turn appears the moment it is asked for, so the
 * agent's silence while it works is visible rather than looking like nothing
 * happened.
 */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const text = useText();
  const language = useLanguage();
  return (
    <>
      {messages.map((message) =>
        message.role === 'user' ? (
          <section className="task-message" key={message.id}>
            <p className="task-message__label">
              {text.you} ·{' '}
              {new Date(message.at).toLocaleTimeString(language, {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            <p className="task-message__text">{message.text}</p>
          </section>
        ) : (
          <section className={`reply${message.failed ? ' reply--failed' : ''}`} key={message.id}>
            {message.text ? (
              <div className="reply__markdown">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  skipHtml
                  components={{
                    a: ({ children, href }) => (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.text}
                </Markdown>
              </div>
            ) : null}
            {message.streaming ? (
              <span className="reply__working">
                <span className="planning__spinner" aria-hidden="true" />
                {text.working}
              </span>
            ) : null}
          </section>
        ),
      )}
    </>
  );
}
