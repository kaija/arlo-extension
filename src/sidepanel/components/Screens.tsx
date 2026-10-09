/** The states where chat cannot start yet, each naming its own fix. */
import { useText } from '../language';
import type { ChatStatus } from '../useChat';

export function ModelSetupScreen() {
  const text = useText();
  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">{text.setupTitle}</h1>
        <p className="screen__lead">{text.setupLead}</p>
      </div>
      <div className="screen__actions">
        <button
          type="button"
          className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          {text.openSettings}
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
  const text = useText();
  if (status === 'bad-endpoint') {
    return (
      <div className="screen">
        <div className="screen__group">
          <h1 className="screen__title">{text.badEndpointTitle}</h1>
          <p className="screen__lead">{text.badEndpointLead(endpoint)}</p>
        </div>
        <div className="screen__actions">
          <button
            type="button"
            className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            {text.openSettings}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">{text.accessTitle}</h1>
        <p className="screen__lead">{text.accessLead}</p>
      </div>
      <div className="screen__actions">
        <button
          type="button"
          className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
          onClick={onAllow}
        >
          {text.allowAccess(hostOf(endpoint))}
        </button>
        <button
          type="button"
          className="panel-btn panel-btn--sm panel-btn--ghost panel-btn--block"
          onClick={onRetry}
        >
          {text.checkAgain}
        </button>
      </div>
    </div>
  );
}
