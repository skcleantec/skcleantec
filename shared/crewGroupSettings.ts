/** 크루 그룹 가용·UI 설정 — 클라이언트·서버 공통 */
export type CrewGroupAvailabilityMode = 'ROSTER' | 'DAY_OFF';
export type CrewUiLanguage = 'KO' | 'TH' | 'MN';

export const CREW_AVAILABILITY_MODES: CrewGroupAvailabilityMode[] = ['ROSTER', 'DAY_OFF'];

export const CREW_AVAILABILITY_MODE_LABELS: Record<CrewGroupAvailabilityMode, string> = {
  ROSTER: '배정(일자 명단)',
  DAY_OFF: '휴무일(기본 근무)',
};

export const CREW_UI_LANGUAGES: CrewUiLanguage[] = ['KO', 'TH', 'MN'];

export const CREW_UI_LANGUAGE_LABELS: Record<CrewUiLanguage, string> = {
  KO: '한국어',
  TH: '태국어',
  MN: '몽골어',
};

export function isCrewGroupRosterMode(mode: CrewGroupAvailabilityMode): boolean {
  return mode === 'ROSTER';
}

export function isCrewGroupDayOffMode(mode: CrewGroupAvailabilityMode): boolean {
  return mode === 'DAY_OFF';
}

/** API·레거시 호환 */
export function availabilityModeToUseDailyRosterOnly(mode: CrewGroupAvailabilityMode): boolean {
  return isCrewGroupRosterMode(mode);
}

export function parseCrewGroupAvailabilityMode(raw: unknown): CrewGroupAvailabilityMode | null {
  if (raw === 'ROSTER' || raw === 'DAY_OFF') return raw;
  return null;
}

export function parseCrewUiLanguage(raw: unknown): CrewUiLanguage | null {
  if (raw === 'KO' || raw === 'TH' || raw === 'MN') return raw;
  return null;
}

/** 크루 앱 UI 언어가 한국어일 때는 보조 표시명(태국어·몽골어) 입력·병기 불필요 */
export function crewUiLanguageShowsAltMemberName(lang: CrewUiLanguage | undefined): boolean {
  return lang === 'TH' || lang === 'MN';
}
