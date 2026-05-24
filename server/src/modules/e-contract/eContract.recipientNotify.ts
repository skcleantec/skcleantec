import { UserRole } from '@prisma/client';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

/** 팀장 전용 화면 갱신 — 마케터는 별도 포털 없음(링크만) */
export function notifyEContractInboxIfTeamLeader(userId: string, role: UserRole): void {
  if (role === UserRole.TEAM_LEADER) {
    notifyInboxRefresh([userId]);
  }
}
