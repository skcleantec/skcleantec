import { Outlet, useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';

/** 일자 명단 중첩 라우트 — 부모(CrewLayout) Outlet 컨텍스트를 하위로 전달 */
export function CrewRosterLayout() {
  const ctx = useOutletContext<CrewLayoutContext>();
  return <Outlet context={ctx} />;
}
