import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { getEmployedStaffUserIds } from '../realtime/navBadgeNotify.js';

async function teamLeaderIdsForInquiry(inquiryId: string, tenantId: string): Promise<string[]> {
  const assigns = await prisma.assignment.findMany({
    where: { inquiryId, tenantId },
    select: { teamLeaderId: true },
  });
  return [...new Set(assigns.map((a) => a.teamLeaderId).filter(Boolean))];
}

/**
 * 검수 체크리스트 변경 시 팀장(배정) + (선택) 스태프에게 inbox:refresh.
 * 클라이언트는 useInboxRealtime → 체크리스트·목록 배지 silent 재조회.
 */
export async function notifyInspectionChecklistRefresh(params: {
  inquiryId: string;
  tenantId: string;
  /** 완료·무효 등 관리자 화면·접수 목록 배지 갱신 */
  includeStaff?: boolean;
}): Promise<void> {
  const exists = await prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId: params.inquiryId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!exists) return;

  const ids = new Set(await teamLeaderIdsForInquiry(params.inquiryId, params.tenantId));
  if (params.includeStaff) {
    for (const id of await getEmployedStaffUserIds(params.tenantId)) ids.add(id);
  }
  if (ids.size === 0) return;
  void notifyInboxRefresh([...ids]);
}
