import { useEffect, useState } from 'react';

import { Logo, TrashIcon } from '../design-system/icons';
import { ACTION_LABELS, DEFAULT_GATED_ACTIONS } from '../core/gate-policy';
import type { ActionKind } from '../core/types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../shared/settings';
import { LlmProfiles } from './LlmProfiles';
import { Alert, Checkbox, Field, Switch } from './controls';

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
  const [loaded, setLoaded] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);

  useEffect(() => {
    void loadSettings().then((next) => {
      setSettings(next);
      setLoaded(true);
    });
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    return next;
  };

  const toggleGate = (action: ActionKind, on: boolean) => {
    const gatedActions = on
      ? [...new Set([...settings.gatedActions, action])]
      : settings.gatedActions.filter((item) => item !== action);
    void update({ gatedActions });
  };

  const gatesAtDefault =
    settings.gatedActions.length === DEFAULT_GATED_ACTIONS.length &&
    DEFAULT_GATED_ACTIONS.every((action) => settings.gatedActions.includes(action));

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <span className="brand">
            <Logo size={28} />
            Arlo <span>Settings</span>
          </span>
          {saved ? <span className="badge badge-success">Saved</span> : null}
        </div>
      </header>

      <main className="page">
        <div className="page-intro">
          <h1>Settings</h1>
          <p>
            Everything here is a brake. Arlo asks before anything it cannot undo, and these are the
            controls that decide what counts.
          </p>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Global switch</h2>
              <p className="card-sub">
                The one brake that overrides everything. Nothing runs on any site while this is on.
              </p>
            </div>
            {settings.pausedEverywhere ? (
              <span className="badge badge-warning">Paused</span>
            ) : (
              <span className="badge badge-success">Active</span>
            )}
          </div>
          <Switch
            checked={settings.pausedEverywhere}
            label="Pause Arlo everywhere"
            onChange={(pausedEverywhere) => void update({ pausedEverywhere })}
          />
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Actions that need confirmation</h2>
              <p className="card-sub">
                Arlo stops and asks before any of these. Unchecking one means it runs without
                asking.
              </p>
            </div>
            {gatesAtDefault ? null : <span className="badge badge-neutral">Customised</span>}
          </div>

          <div className="check-grid">
            {GATEABLE_ACTIONS.map((action) => (
              <Checkbox
                key={action}
                checked={settings.gatedActions.includes(action)}
                label={ACTION_LABELS[action]}
                onChange={(on) => toggleGate(action, on)}
              />
            ))}
          </div>

          <div className="card-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={gatesAtDefault}
              onClick={() => void update({ gatedActions: DEFAULT_GATED_ACTIONS })}
            >
              Reset to defaults
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Blocked sites</h2>
              <p className="card-sub">
                Arlo will never operate on these hostnames or their subdomains. One per line.
              </p>
            </div>
          </div>
          <Field
            id="blocked-domains"
            label="Hostnames"
            hint="Subdomains are covered automatically — blocking example.com also blocks app.example.com."
          >
            <textarea
              id="blocked-domains"
              className="input"
              rows={6}
              spellCheck={false}
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
          </Field>
        </section>

        {loaded ? <LlmProfiles settings={settings} onUpdate={update} /> : null}

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Run history</h2>
              <p className="card-sub">
                What Arlo did, kept locally on this machine and never sent anywhere.
              </p>
            </div>
          </div>

          <Field id="retention" label="Keep history for" hint="0 keeps nothing.">
            <div className="row">
              <input
                id="retention"
                className="input grow"
                type="number"
                min={0}
                max={365}
                value={settings.historyRetentionDays}
                onChange={(event) =>
                  setSettings({ ...settings, historyRetentionDays: Number(event.target.value) })
                }
                onBlur={() => void update({ historyRetentionDays: settings.historyRetentionDays })}
              />
              <span className="field-hint">days</span>
            </div>
          </Field>

          {historyCleared ? (
            <div style={{ marginTop: 16 }}>
              <Alert tone="success" onClose={() => setHistoryCleared(false)}>
                Run history cleared.
              </Alert>
            </div>
          ) : null}

          <div className="card-footer">
            <button
              type="button"
              className="btn btn-danger btn-icon"
              onClick={() => {
                void chrome.storage.local.remove('arlo:history');
                setHistoryCleared(true);
              }}
            >
              <TrashIcon size={16} />
              Clear history now
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
