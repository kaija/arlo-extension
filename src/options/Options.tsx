import { useEffect, useState } from 'react';

import { ACTION_LABELS, DEFAULT_GATED_ACTIONS } from '../core/gate-policy';
import type { ActionKind } from '../core/types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../shared/settings';

const GATEABLE_ACTIONS: ActionKind[] = [
  'submit_form',
  'purchase',
  'send_message',
  'delete',
  'sign_in',
  'change_settings',
  'navigate',
  'open_tab',
];

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const toggleGate = (action: ActionKind, on: boolean) => {
    const gatedActions = on
      ? [...new Set([...settings.gatedActions, action])]
      : settings.gatedActions.filter((item) => item !== action);
    void update({ gatedActions });
  };

  return (
    <div className="options">
      <header className="app__header" style={{ borderRadius: 'var(--radius)' }}>
        <span className="app__brand">Arlo — Settings</span>
        {saved ? <span className="saved">Saved</span> : null}
      </header>

      <section className="card">
        <h2 className="card__title">Global switch</h2>
        <p className="card__note">
          The one brake that overrides everything. Nothing runs on any site while this is on.
        </p>
        <label className="switch" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={settings.pausedEverywhere}
            onChange={(event) => void update({ pausedEverywhere: event.target.checked })}
          />
          Pause Arlo everywhere
        </label>
      </section>

      <section className="card">
        <h2 className="card__title">Blocked sites</h2>
        <p className="card__note">
          Arlo will never operate on these hostnames or their subdomains. One per line.
        </p>
        <div className="field">
          <textarea
            rows={7}
            value={settings.blockedDomains.join('\n')}
            onChange={(event) =>
              setSettings({ ...settings, blockedDomains: event.target.value.split('\n') })
            }
            onBlur={() =>
              void update({
                blockedDomains: settings.blockedDomains
                  .map((domain) => domain.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Actions that need confirmation</h2>
        <p className="card__note">
          Arlo stops and asks before any of these. Unchecking one means it runs without asking.
        </p>
        <ul className="checklist">
          {GATEABLE_ACTIONS.map((action) => (
            <li key={action}>
              <label>
                <input
                  type="checkbox"
                  checked={settings.gatedActions.includes(action)}
                  onChange={(event) => toggleGate(action, event.target.checked)}
                />
                {ACTION_LABELS[action]}
              </label>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button
            type="button"
            className="button"
            onClick={() => void update({ gatedActions: DEFAULT_GATED_ACTIONS })}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Model</h2>
        <div className="field">
          <label htmlFor="model">Model</label>
          <input
            id="model"
            type="text"
            value={settings.model}
            onChange={(event) => setSettings({ ...settings, model: event.target.value })}
            onBlur={() => void update({ model: settings.model })}
          />
        </div>
        <div className="field">
          <label htmlFor="api-key">API key</label>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            value={settings.apiKey}
            onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
            onBlur={() => void update({ apiKey: settings.apiKey })}
          />
          <small>
            Stored in this browser profile only. It is never sent anywhere but the model.
          </small>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Run history</h2>
        <div className="field">
          <label htmlFor="retention">Keep history for (days)</label>
          <input
            id="retention"
            type="number"
            min={0}
            max={365}
            value={settings.historyRetentionDays}
            onChange={(event) =>
              setSettings({ ...settings, historyRetentionDays: Number(event.target.value) })
            }
            onBlur={() => void update({ historyRetentionDays: settings.historyRetentionDays })}
          />
          <small>0 keeps nothing.</small>
        </div>
        <div className="actions">
          <button
            type="button"
            className="button button--danger"
            onClick={() => void chrome.storage.local.remove('arlo:history')}
          >
            Clear history now
          </button>
        </div>
      </section>
    </div>
  );
}
