import { CheckIcon } from '../../design-system/icons';

/**
 * Site access is asked for here rather than at install time, so the user grants
 * it knowing what Arlo will do with it.
 */
export function Onboarding({ onAllow }: { onAllow: () => void }) {
  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">Arlo works the page for you</h1>
        <p className="screen__lead">
          Arlo is not a chat assistant. It clicks, types, scrolls and changes pages in the tab you
          are looking at, until the task is done.
        </p>
      </div>

      <div className="screen__group">
        <div className="eyebrow">For example</div>
        <ul className="examples">
          <li>“Reorder the coffee beans I bought last month, if they are still under $25.”</li>
          <li>“Fill this application form with my saved details.”</li>
          <li>“Compare the top 3 items on this page and add the cheapest to my cart.”</li>
        </ul>
      </div>

      <div className="screen__group">
        <div className="eyebrow">Before it can start</div>
        <ul className="promises">
          <li>
            <CheckIcon size={14} />
            <span>
              <strong>It can read and act on any site you visit.</strong> Access is granted once,
              here.
            </span>
          </li>
          <li>
            <CheckIcon size={14} />
            <span>
              <strong>You always see the plan first,</strong> and Arlo stops before anything
              irreversible — orders, messages, deletions, sign-ins.
            </span>
          </li>
          <li>
            <CheckIcon size={14} />
            <span>
              <strong>You can switch it off everywhere</strong> from Settings at any time.
            </span>
          </li>
        </ul>
      </div>

      <div className="screen__actions">
        <button
          type="button"
          className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
          onClick={onAllow}
        >
          Allow Arlo to work on websites
        </button>
        <button
          type="button"
          className="panel-btn panel-btn--sm panel-btn--ghost panel-btn--block"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Review settings first
        </button>
      </div>
    </div>
  );
}

export function BlockedScreen() {
  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">Arlo is switched off here</h1>
        <p className="screen__lead">
          This site is on your block list, or Arlo is paused everywhere. Both are in Settings.
        </p>
      </div>
      <div className="screen__actions">
        <button
          type="button"
          className="panel-btn panel-btn--md panel-btn--secondary panel-btn--block"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Open settings
        </button>
      </div>
    </div>
  );
}

export function ModelSetupScreen() {
  return (
    <div className="screen">
      <div className="screen__group">
        <h1 className="screen__title">Connect an AI model to start</h1>
        <p className="screen__lead">
          Add an Anthropic or OpenAI-compatible profile and choose the default model Arlo should
          use. Requests go straight from this browser to that endpoint.
        </p>
      </div>
      <div className="screen__actions">
        <button
          type="button"
          className="panel-btn panel-btn--md panel-btn--primary panel-btn--block"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Open AI settings
        </button>
      </div>
    </div>
  );
}
