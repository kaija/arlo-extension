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

export function BridgeOfflineScreen({ url }: { url: string }) {
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
        <p className="idle__footnote">Looking for it at {url}</p>
      </div>
      <div className="screen__actions">
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
