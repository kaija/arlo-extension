import { useEffect, useRef } from 'react';

import { CloseIcon, WarningIcon } from '../design-system/icons';
import { Composer } from './components/Composer';
import { Dock } from './components/Dock';
import { IdleScreen } from './components/IdleScreen';
import { MessageList } from './components/MessageList';
import { PanelHeader } from './components/PanelHeader';
import { BridgeOfflineScreen, ModelSetupScreen } from './components/Screens';
import { useActivePage } from './useActivePage';
import { useChat } from './useChat';

export function App() {
  const chat = useChat();
  const page = useActivePage();
  const thread = useRef<HTMLDivElement>(null);
  const count = chat.session.messages.length;
  const latestText = chat.session.messages.at(-1)?.text;

  // Follow the transcript down as it grows.
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, latestText]);

  const body = () => {
    if (chat.status !== 'ok' && chat.status !== 'checking') {
      return (
        <BridgeOfflineScreen
          status={chat.status}
          url={chat.bridgeUrl}
          onAllow={() => void chat.allowAccess()}
          onRetry={chat.recheck}
        />
      );
    }
    if (!chat.configured) return <ModelSetupScreen />;
    if (count === 0)
      return <IdleScreen busy={chat.session.running} page={page} onSubmit={chat.send} />;
    return (
      <div className="thread" ref={thread}>
        <MessageList messages={chat.session.messages} />
      </div>
    );
  };

  const ready = chat.status === 'ok' && chat.configured;

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
