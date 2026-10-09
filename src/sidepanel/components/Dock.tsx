import type { LlmProfileSummary } from '../../shared/settings';
import { useText } from '../language';

/**
 * The foot of the panel: what you type into, and which model will act on it.
 * It is the same in every state, so the input never moves out from under you.
 */
export function Dock({
  profile,
  children,
}: React.PropsWithChildren<{ profile: LlmProfileSummary | null }>) {
  return (
    <div className="dock">
      {children}
      {profile ? <ModelChip profile={profile} /> : null}
    </div>
  );
}

function ModelChip({ profile }: { profile: LlmProfileSummary }) {
  const text = useText();
  return (
    <button
      type="button"
      className="model-chip"
      title={text.requestsGoTo(profile.origin)}
      onClick={() => chrome.runtime.openOptionsPage()}
    >
      <span className="model-chip__name">
        <strong>{profile.name}</strong>
        <span className="model-chip__model">{profile.model}</span>
      </span>
      <span className="model-chip__cta" aria-hidden="true">
        {text.aiSettings}
      </span>
    </button>
  );
}
