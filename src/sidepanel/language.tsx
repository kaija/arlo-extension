import { useEffect, useState, type ReactNode } from 'react';

import { DEFAULT_LANGUAGE, type Language } from '../shared/language';
import { LanguageContext, useLanguage } from '../shared/language-context';
import { loadSettings, onSettingsChanged } from '../shared/settings';
import { panelText, type PanelText } from './text';

/** The saved language, kept current when it is changed on the Settings page. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    let live = true;
    void loadSettings().then((settings) => live && setLanguage(settings.language));
    const stop = onSettingsChanged((settings) => setLanguage(settings.language));
    return () => {
      live = false;
      stop();
    };
  }, []);

  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

/** The panel's strings in the current language; English outside a provider. */
export function useText(): PanelText {
  return panelText(useLanguage());
}

export { useLanguage };
