import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

export function notifyCrewGroupsInboxRefresh(crewGroupIds: string[]): void {
  const ids = [...new Set(crewGroupIds.filter(Boolean))];
  if (ids.length === 0) return;
  notifyInboxRefresh(ids.map((id) => `crew:${id}`));
}

/** 접수·배정·명단 변경 시 크루 화면이 GET을 다시 하도록 — 활성 크루 그룹 전부에 신호 */
export async function notifyAllActiveCrewGroupsRefresh(): Promise<void> {
  const rows = await prisma.teamCrewGroup.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  notifyCrewGroupsInboxRefresh(rows.map((r) => r.id));
}
