import { useEffect, useState } from 'react';

import { Logo } from '../design-system/icons';
import {
  DEFAULT_SETTINGS,
  MAX_TURNS_MAX,
  MAX_TURNS_MIN,
  loadSettings,
  saveSettings,
  type Settings,
} from '../shared/settings';
import { THEME_PREFERENCES, themeLabel } from '../shared/theme';
import { Field } from './controls';
import { LlmProfiles } from './LlmProfiles';

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Held as text so the field can be emptied while typing a new number.
  const [maxTurnsDraft, setMaxTurnsDraft] = useState(String(DEFAULT_SETTINGS.maxTurns));

  useEffect(() => {
    void loadSettings().then((next) => {
      setSettings(next);
      setMaxTurnsDraft(String(next.maxTurns));
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

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Agent</h2>
              <p className="card-sub">
                How many steps Arlo may take to answer one message. Each model call, including the
                ones that read or open a page, counts as a step. Raise it for long tasks; lower it
                to cap cost.
              </p>
            </div>
          </div>

          <Field
            id="max-turns"
            label="Max turns"
            hint={`${MAX_TURNS_MIN} to ${MAX_TURNS_MAX}. Default 25.`}
          >
            <input
              id="max-turns"
              className="input"
              type="number"
              inputMode="numeric"
              min={MAX_TURNS_MIN}
              max={MAX_TURNS_MAX}
              step={1}
              value={maxTurnsDraft}
              onChange={(event) => setMaxTurnsDraft(event.target.value)}
              onBlur={() => {
                const parsed = Number.parseInt(maxTurnsDraft, 10);
                const value = Number.isNaN(parsed) ? settings.maxTurns : parsed;
                void update({ maxTurns: value }).then((next) =>
                  setMaxTurnsDraft(String(next.maxTurns)),
                );
              }}
            />
          </Field>
        </section>

        {loaded ? <LlmProfiles settings={settings} onUpdate={update} /> : null}
      </main>
    </>
  );
}
