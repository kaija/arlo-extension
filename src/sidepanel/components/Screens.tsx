/** The states where chat cannot start yet, each naming its own fix. */
import type { ChatStatus } from '../useChat';

export function ModelSetupScreen() {
  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">Connect a model to start</h1>
        <p className="screen__lead">
          Arlo needs an OpenAI-compatible endpoint and a key. Add one in settings and it will be
          ready here.
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

interface ModelAccessScreenProps {
  status: Extract<ChatStatus, 'no-model-access' | 'bad-endpoint'>;
  endpoint: string;
  onAllow: () => void;
  onRetry: () => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * The panel calls the model itself, so Chrome has to allow the one origin the
 * profile points at. Asking here rather than at install keeps the grant narrow
 * and legible: a single named host, revocable.
 */
export function ModelAccessScreen({ status, endpoint, onAllow, onRetry }: ModelAccessScreenProps) {
  if (status === 'bad-endpoint') {
    return (
      <div className="screen">
        <div className="screen__group">
          <h1 className="screen__title">That endpoint can’t be used</h1>
          <p className="screen__lead">
            Arlo can only talk to an <code>http://</code> or <code>https://</code> address. This
            profile’s Base URL is {endpoint || 'empty'}.
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

  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">Allow Arlo to reach your model</h1>
        <p className="screen__lead">
          Chrome asks before an extension may contact a site. Arlo needs this for the endpoint your
          profile points at, and nothing else.
        </p>
      </div>
      <div className="screen__actions">
        <button
          type="button"
          className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
          onClick={onAllow}
        >
          Allow access to {hostOf(endpoint)}
        </button>
        <button
          type="button"
          className="panel-btn panel-btn--sm panel-btn--ghost panel-btn--block"
          onClick={onRetry}
        >
          Check again
        </button>
      </div>
    </div>
  );
}
