import { useEffect, useRef, useState } from 'react';

import { CloseIcon, WarningIcon } from '../design-system/icons';
import { hasPageAccess, requestPageAccess } from '../shared/page-access';
import { Composer } from './components/Composer';
import { Dock } from './components/Dock';
import { IdleScreen } from './components/IdleScreen';
import { MessageList } from './components/MessageList';
import { PanelHeader } from './components/PanelHeader';
import { ModelAccessScreen, ModelSetupScreen } from './components/Screens';
import { useActivePage } from './useActivePage';
import { useChat } from './useChat';

export function App() {
  const chat = useChat();
  const page = useActivePage();
  const thread = useRef<HTMLDivElement>(null);
  // Assume granted until Chrome says otherwise, so the offer never flashes.
  const [pageAccess, setPageAccess] = useState(true);
  const count = chat.session.messages.length;
  const latestText = chat.session.messages.at(-1)?.text;

  useEffect(() => {
    void hasPageAccess().then(setPageAccess);
  }, []);

  // Follow the transcript down as it grows.
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, latestText]);

  const body = () => {
    if (chat.status === 'unconfigured') return <ModelSetupScreen />;
    if (chat.status === 'no-model-access' || chat.status === 'bad-endpoint') {
      return (
        <ModelAccessScreen
          status={chat.status}
          endpoint={chat.endpoint}
          onAllow={() => void chat.allowAccess()}
          onRetry={chat.recheck}
        />
      );
    }
    if (chat.status === 'checking') return null;
    if (count === 0)
      return <IdleScreen busy={chat.session.running} page={page} onSubmit={chat.send} />;
    return (
      <div className="thread" ref={thread}>
        <MessageList messages={chat.session.messages} />
      </div>
    );
  };

  const ready = chat.status === 'ready';

  return (
    <div className="panel">
      <PanelHeader onNewTask={chat.reset} onOpenSettings={() => chrome.runtime.openOptionsPage()} />

      {chat.error ? (
        <div className="panel-alert" role="alert">
          <WarningIcon size={15} />
          <div className="panel-alert__body">
            <span>{chat.error}</span>
          </div>
          <button
            type="button"
            className="panel-alert__dismiss"
            onClick={chat.dismissError}
            title="Dismiss"
          >
            <CloseIcon />
            <span className="visually-hidden">Dismiss</span>
          </button>
        </div>
      ) : null}

      {body()}

      {ready ? (
        <Dock profile={chat.profile}>
          {pageAccess ? null : (
            <button
              type="button"
              className="panel-btn panel-btn--sm panel-btn--secondary panel-btn--block"
              title="Otherwise Chrome only lets Arlo read the page for one toolbar click, until you navigate"
              onClick={() => void requestPageAccess().then(setPageAccess)}
            >
              Let Arlo read pages without a toolbar click
            </button>
          )}
          <Composer
            placeholder={chat.session.running ? 'Arlo is working…' : 'Ask Arlo to build something…'}
            disabled={chat.session.running}
            onSubmit={(prompt) => void chat.send(prompt)}
          />
        </Dock>
      ) : null}
    </div>
  );
}
