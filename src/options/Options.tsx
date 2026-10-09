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
import { LANGUAGES, languageLabel } from '../shared/language';
import { LanguageContext } from '../shared/language-context';
import { THEME_PREFERENCES } from '../shared/theme';
import { Alert, Field, Switch } from './controls';
import { LlmProfiles } from './LlmProfiles';
import { optionsText } from './text';

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

  const [mic, setMic] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const t = optionsText(settings.language);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  /**
   * The side panel often cannot show Chrome's microphone prompt, but this page
   * can, and the answer is stored for the whole extension.
   */
  const allowMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setMic({ tone: 'success', text: t.micAllowed });
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      setMic({
        tone: 'warning',
        text: name === 'NotFoundError' ? t.micNotFound : t.micDenied,
      });
    }
  };

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    return next;
  };

  // Nothing is drawn until the saved language is known, so the page never
  // flashes in English first.
  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={settings.language}>
      <header className="topbar">
        <div className="topbar__inner">
          <span className="brand">
            <Logo size={28} />
            Arlo <span>{t.brandSuffix}</span>
          </span>
          {saved ? <span className="badge badge-success">{t.saved}</span> : null}
        </div>
      </header>

      <main className="page">
        <div className="page-intro">
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">{t.appearanceTitle}</h2>
              <p className="card-sub">{t.appearanceSub}</p>
            </div>
          </div>

          <fieldset className="segmented">
            <legend className="visually-hidden">{t.themeLegend}</legend>
            {THEME_PREFERENCES.map((preference) => (
              <label className="segmented__option" key={preference}>
                <input
                  type="radio"
                  name="theme"
                  value={preference}
                  checked={settings.theme === preference}
                  onChange={() => void update({ theme: preference })}
                />
                <span>{t.theme[preference]}</span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">{t.languageTitle}</h2>
              <p className="card-sub">{t.languageSub}</p>
            </div>
          </div>

          <fieldset className="segmented">
            <legend className="visually-hidden">{t.languageLegend}</legend>
            {LANGUAGES.map((language) => (
              <label className="segmented__option" key={language}>
                <input
                  type="radio"
                  name="language"
                  value={language}
                  checked={settings.language === language}
                  onChange={() => void update({ language })}
                />
                <span>{languageLabel(language)}</span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">{t.agentTitle}</h2>
              <p className="card-sub">{t.agentSub}</p>
            </div>
          </div>

          <Field
            id="max-turns"
            label={t.maxTurnsLabel}
            hint={t.maxTurnsHint(MAX_TURNS_MIN, MAX_TURNS_MAX)}
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

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">{t.voiceTitle}</h2>
              <p className="card-sub">{t.voiceSub}</p>
            </div>
          </div>

          <div className="form-stack">
            <Switch
              checked={settings.voiceAutoSend}
              label={t.autoSendLabel}
              onChange={(voiceAutoSend) => void update({ voiceAutoSend })}
            />
            <p className="field-hint">{t.autoSendHint}</p>
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={() => void allowMicrophone()}>
                {t.allowMicrophone}
              </button>
            </div>
            {mic ? <Alert tone={mic.tone}>{mic.text}</Alert> : null}
          </div>
        </section>

        <LlmProfiles settings={settings} onUpdate={update} />
      </main>
    </LanguageContext.Provider>
  );
}
