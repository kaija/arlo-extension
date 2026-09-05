import { useEffect, useState } from 'react';

import { Logo } from '../design-system/icons';
import { BRIDGE_HOST_PERMISSIONS } from '../manifest.config';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../shared/settings';
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
        headers: { authorization: `Bearer ${settings.bridgeToken}` },
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
            Arlo runs a Codex agent in a local bridge process. Point the extension at it, then give
            it a model to think with.
          </p>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Bridge</h2>
              <p className="card-sub">
                The agent runs outside the browser. Start it with{' '}
                <code>cd bridge &amp;&amp; npm start</code> — it prints a token on the first line.
              </p>
            </div>
            {bridge === 'online' ? <span className="badge badge-success">Online</span> : null}
            {bridge === 'offline' ? <span className="badge badge-danger">Offline</span> : null}
            {bridge === 'unauthorized' ? (
              <span className="badge badge-warning">Token rejected</span>
            ) : null}
            {bridge === 'rejected' ? (
              <span className="badge badge-warning">Origin rejected</span>
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
              hint="Printed when the bridge starts. It changes on every restart unless you set ARLO_BRIDGE_TOKEN."
            >
              <div className="row">
                <input
                  id="bridge-token"
                  className="input grow"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={settings.bridgeToken}
                  onChange={(event) =>
                    setSettings({ ...settings, bridgeToken: event.target.value })
                  }
                  onBlur={() => void update({ bridgeToken: settings.bridgeToken })}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={bridge === 'checking'}
                  onClick={() => void checkBridge()}
                >
                  {bridge === 'checking' ? 'Checking…' : 'Test connection'}
                </button>
              </div>
            </Field>
          </div>
        </section>

        {loaded ? <LlmProfiles settings={settings} onUpdate={update} /> : null}
      </main>
    </>
  );
}
