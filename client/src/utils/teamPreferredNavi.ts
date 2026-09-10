import type { StaffFieldNaviApp } from './staffFieldNavi';

const KEY = 'cbiseo.team.preferredNavi';

export function readPreferredTeamNavi(): StaffFieldNaviApp | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'tmap') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function writePreferredTeamNavi(app: StaffFieldNaviApp): void {
  try {
    localStorage.setItem(KEY, app);
  } catch {
    /* ignore */
  }
}

export function clearPreferredTeamNavi(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
