/** The two states where chat cannot start yet, each naming its own fix. */

export function ModelSetupScreen() {
  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">Connect a model to start</h1>
        <p className="screen__lead">
          Add an OpenAI-compatible profile and paste the token the bridge printed when it started.
        </p>
      </div>
      <div className="screen__actions">
        <button
          type="button"
          className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Open settings
        </button>
      </div>
    </div>
  );
}

interface BridgeScreenProps {
  status: 'offline' | 'forbidden' | 'unconfigured';
  url: string;
  onAllow: () => void;
  onRetry: () => void;
}

/**
 * A blocked request and a dead server look the same from inside a `catch`, so
 * each reason gets its own screen. Nothing here tells you to start something
 * that is already running.
 */
export function BridgeOfflineScreen({ status, url, onAllow, onRetry }: BridgeScreenProps) {
  if (status === 'unconfigured') {
    return (
      <div className="screen">
        <div className="screen__group">
          <h1 className="screen__title">No bridge address</h1>
          <p className="screen__lead">
            Arlo needs the address of the local process that runs the agent.
          </p>
        </div>
        <div className="screen__actions">
          <button
            type="button"
            className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            Open settings
          </button>
        </div>
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="screen">
        <div className="screen__group">
          <h1 className="screen__title">Chrome is blocking the bridge</h1>
          <p className="screen__lead">
            The bridge may well be running — Chrome needs your permission before the panel can reach
            a local address. This is the only site access Arlo asks for.
          </p>
        </div>
        <div className="screen__actions">
          <button
            type="button"
            className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
            onClick={onAllow}
          >
            Allow access to {hostOf(url)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">The bridge isn’t running</h1>
        <p className="screen__lead">
          The agent runs in a local process, not in the browser. Start it and this will connect on
          its own.
        </p>
      </div>
      <div className="screen__group">
        <div className="eyebrow">In the project</div>
        <ul className="examples">
          <li>cd bridge &amp;&amp; npm start</li>
        </ul>
        <p className="idle__footnote">Looking for it at {url}, retrying every few seconds.</p>
      </div>
      <div className="screen__actions">
        <button
          type="button"
          className="panel-btn panel-btn--sm panel-btn--secondary panel-btn--block"
          onClick={onRetry}
        >
          Try now
        </button>
        <button
          type="button"
          className="panel-btn panel-btn--sm panel-btn--ghost panel-btn--block"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Change the bridge address
        </button>
      </div>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'the bridge';
  }
}
