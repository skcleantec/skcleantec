import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import { isCrewGroupRosterMode } from '@shared/crewGroupSettings';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';

/** 일자 명단 중첩 라우트 — ROSTER 그룹만 접근 */
export function CrewRosterLayout() {
  const ctx = useOutletContext<CrewLayoutContext>();
  const mode =
    ctx?.me?.group.availabilityMode ??
    (ctx?.me?.group.useDailyRosterOnly ? 'ROSTER' : 'DAY_OFF');
  if (ctx?.me && !isCrewGroupRosterMode(mode)) {
    return <Navigate to="/crew/schedule" replace />;
  }
  return <Outlet context={ctx} />;
}
