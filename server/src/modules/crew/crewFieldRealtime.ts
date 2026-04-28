import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { sendJsonToUser } from '../realtime/realtimeHub.js';

/** 팀장 UUID·크루 `crew:${id}` 모두 동일 페이로드 */
export type RosterAckPayload = {
  type: 'inquiry:rosterAck';
  messageKo: string;
  messageTh: string;
};
/** @deprecated 이름 호환 */
export type CrewRosterAckPayload = RosterAckPayload;

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

/** 현장 팀원 구성 변경(미팅 시각 초기화 등) — 활성 크루 그룹 상단 확인 팝업 */
export async function notifyAllActiveCrewRosterAck(messages: {
  messageKo: string;
  messageTh: string;
}): Promise<void> {
  const rows = await prisma.teamCrewGroup.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const payload: RosterAckPayload = { type: 'inquiry:rosterAck', ...messages };
  for (const r of rows) sendJsonToUser(`crew:${r.id}`, payload);
}

/** 동일 접수에 배정된 팀장(USER id) — 상단 확인 팝업 */
export function notifyTeamLeaderUsersRosterAck(
  teamLeaderIds: string[],
  messages: { messageKo: string; messageTh: string },
): void {
  const ids = [...new Set(teamLeaderIds.filter(Boolean))];
  if (ids.length === 0) return;
  const payload: RosterAckPayload = { type: 'inquiry:rosterAck', ...messages };
  for (const id of ids) sendJsonToUser(id, payload);
}
