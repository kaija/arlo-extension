import { createContext, useContext } from 'react';

import { DEFAULT_LANGUAGE, type Language } from './language';

/** Which language the surface that renders it should speak; English outside a provider. */
export const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE);

export function useLanguage(): Language {
  return useContext(LanguageContext);
}
