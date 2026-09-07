import { useEffect, useState } from 'react';

import { Logo } from '../design-system/icons';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../shared/settings';
import { THEME_PREFERENCES, themeLabel } from '../shared/theme';
import { LlmProfiles } from './LlmProfiles';

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
            Arlo runs its agent inside the side panel. Give it a model to think with — there is
            nothing else to set up.
          </p>
        </div>

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
