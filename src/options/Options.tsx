import { useEffect, useState } from 'react';

import { Logo } from '../design-system/icons';
import { BRIDGE_HOST_PERMISSIONS } from '../manifest.config';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../shared/settings';
import { THEME_PREFERENCES, themeLabel } from '../shared/theme';
import { LlmProfiles } from './LlmProfiles';
import { Alert, Field } from './controls';

type BridgeState = 'unknown' | 'checking' | 'online' | 'offline' | 'unauthorized' | 'rejected';

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [bridge, setBridge] = useState<BridgeState>('unknown');
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    void loadSettings().then((next) => {
      setSettings(next);
      setLoaded(true);
    });
    void chrome.permissions
      .contains({ origins: BRIDGE_HOST_PERMISSIONS })
      .then(setGranted)
      .catch(() => setGranted(false));
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    return next;
  };

  /** Chrome only grants an optional permission inside a click handler. */
  const allowLoopback = async () => {
    setGranted(await chrome.permissions.request({ origins: BRIDGE_HOST_PERMISSIONS }));
  };

  /**
   * Checks the authenticated route, not just liveness. /health answers without
   * a token, so testing that reported "online" while every real request was
   * being refused.
   */
  const checkBridge = async () => {
    setBridge('checking');
    try {
      const response = await fetch(new URL('/verify', settings.bridgeUrl), {
        headers: settings.bridgeToken
          ? { authorization: `Bearer ${settings.bridgeToken}` }
          : undefined,
      });
      if (response.ok) setBridge('online');
      else setBridge(response.status === 401 ? 'unauthorized' : 'rejected');
    } catch {
      setBridge('offline');
    }
  };

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
            Arlo runs a Codex agent in a local bridge process. Start the bridge and give it a model
            to think with — there is nothing else to set up.
          </p>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Bridge</h2>
              <p className="card-sub">
                The agent runs outside the browser. Start it with{' '}
                <code>cd bridge &amp;&amp; npm start</code> — it pairs with this extension by
                itself, so there is nothing to copy.
              </p>
            </div>
            {bridge === 'online' ? <span className="badge badge-success">Online</span> : null}
            {bridge === 'offline' ? <span className="badge badge-danger">Offline</span> : null}
            {bridge === 'unauthorized' ? (
              <span className="badge badge-warning">Token rejected</span>
            ) : null}
            {bridge === 'rejected' ? (
              <span className="badge badge-warning">Paired elsewhere</span>
            ) : null}
          </div>

          {!granted ? (
            <div style={{ marginBottom: 16 }}>
              <Alert tone="warning" title="Loopback access not granted">
                Chrome needs permission before the panel can reach a local address.
                <div className="row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-sm" onClick={() => void allowLoopback()}>
                    Allow
                  </button>
                </div>
              </Alert>
            </div>
          ) : null}

          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={bridge === 'checking'}
              onClick={() => void checkBridge()}
            >
              {bridge === 'checking' ? 'Checking…' : 'Test connection'}
            </button>
          </div>

          <details className="advanced">
            <summary>Advanced</summary>
            <div className="form-stack">
              <Field id="bridge-url" label="Bridge address" hint="Loopback only — 127.0.0.1.">
                <input
                  id="bridge-url"
                  className="input"
                  type="url"
                  spellCheck={false}
                  value={settings.bridgeUrl}
                  onChange={(event) => setSettings({ ...settings, bridgeUrl: event.target.value })}
                  onBlur={() => void update({ bridgeUrl: settings.bridgeUrl })}
                />
              </Field>

              <Field
                id="bridge-token"
                label="Bridge token"
                hint="Only needed if you started the bridge with ARLO_BRIDGE_TOKEN. Leave empty otherwise."
              >
                <input
                  id="bridge-token"
                  className="input"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={settings.bridgeToken}
                  onChange={(event) =>
                    setSettings({ ...settings, bridgeToken: event.target.value })
                  }
                  onBlur={() => void update({ bridgeToken: settings.bridgeToken })}
                />
              </Field>
            </div>
          </details>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Appearance</h2>
              <p className="card-sub">
                Applies to Settings and to the side panel, immediately. System follows whatever this
                computer is set to.
              </p>
            </div>
          </div>

          <fieldset className="segmented">
            <legend className="visually-hidden">Theme</legend>
            {THEME_PREFERENCES.map((preference) => (
              <label className="segmented__option" key={preference}>
                <input
                  type="radio"
                  name="theme"
                  value={preference}
                  checked={settings.theme === preference}
                  onChange={() => void update({ theme: preference })}
                />
                <span>{themeLabel(preference)}</span>
              </label>
            ))}
          </fieldset>
        </section>

        {loaded ? <LlmProfiles settings={settings} onUpdate={update} /> : null}
      </main>
    </>
  );
}
