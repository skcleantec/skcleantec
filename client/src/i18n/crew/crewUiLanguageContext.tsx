import { createContext, useContext, type ReactNode } from 'react';
import type { CrewUiLanguage } from '@shared/crewGroupSettings';

export type CrewUiLangKey = 'ko' | 'th' | 'mn';

export function crewUiLanguageToKey(lang: CrewUiLanguage | undefined): CrewUiLangKey {
  if (lang === 'TH') return 'th';
  if (lang === 'MN') return 'mn';
  return 'ko';
}

const CrewUiLanguageContext = createContext<CrewUiLangKey>('ko');

export function CrewUiLanguageProvider({
  crewUiLanguage,
  children,
}: {
  crewUiLanguage?: CrewUiLanguage;
  children: ReactNode;
}) {
  return (
    <CrewUiLanguageContext.Provider value={crewUiLanguageToKey(crewUiLanguage)}>
      {children}
    </CrewUiLanguageContext.Provider>
  );
}

export function useCrewUiLang(): CrewUiLangKey {
  return useContext(CrewUiLanguageContext);
}
