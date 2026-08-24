import { prisma } from '../../lib/prisma.js';
import {
  buildAssignmentPushPayload,
  type StaffAppPushPayload,
} from '../../lib/staffAppPush.helpers.js';
import { notifyStaffInboxRefresh } from '../realtime/navBadgeNotify.js';

/**
 * 접수 PATCH — 팀장 배정·해제·재배정 시 FCM(assignment) + WS 갱신.
 * POST /assignments 와 동일하게 `notifyNewAssignmentForInquiry` 를 사용한다.
 */
export async function notifyAfterInquiryPatch(params: {
  tenantId: string;
  inquiryBefore: { assignments: { teamLeaderId: string }[] };
  inquiryAfter: {
    id: string;
    inquiryNumber: string | null;
    customerName: string;
    assignments: { teamLeaderId: string }[];
  };
  lines: string[];
}): Promise<void> {
  void params.lines;
  const beforeSet = new Set(params.inquiryBefore.assignments.map((a) => a.teamLeaderId));
  const afterSet = new Set(params.inquiryAfter.assignments.map((a) => a.teamLeaderId));
  const newTeamLeaderIds = [...afterSet].filter((id) => !beforeSet.has(id));
  const previousTeamLeaderIds = [...beforeSet].filter((id) => !afterSet.has(id));
  if (newTeamLeaderIds.length === 0 && previousTeamLeaderIds.length === 0) return;

  await notifyNewAssignmentForInquiry(
    params.tenantId,
    params.inquiryAfter.id,
    newTeamLeaderIds,
    previousTeamLeaderIds,
  );
}

/**
 * 팀장 배정·재배정 직후: 해당 팀장(및 직전 담당)에게 WS `inbox:refresh` + 유형별 FCM.
 */
export async function notifyNewAssignmentForInquiry(
  tenantId: string,
  inquiryId: string,
  newTeamLeaderIds: string[],
  previousTeamLeaderIds: string[] = [],
): Promise<void> {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { customerName: true },
  });
  const customerName = inquiry?.customerName?.trim() || '고객';

  const leaderIds = [...new Set([...newTeamLeaderIds, ...previousTeamLeaderIds])];
  const users = await prisma.user.findMany({
    where: { id: { in: leaderIds }, tenantId },
    select: { id: true, role: true },
  });
  const roleById = new Map(users.map((u) => [u.id, u.role]));

  const pushByUserId: Record<string, StaffAppPushPayload> = {};
  for (const id of newTeamLeaderIds) {
    pushByUserId[id] = buildAssignmentPushPayload({
      customerName,
      inquiryId,
      role: roleById.get(id),
      variant: 'new',
    });
  }
  for (const id of previousTeamLeaderIds) {
    if (newTeamLeaderIds.includes(id)) continue;
    pushByUserId[id] = buildAssignmentPushPayload({
      customerName,
      inquiryId,
      role: roleById.get(id),
      variant: 'removed',
    });
  }

  await notifyStaffInboxRefresh(tenantId, leaderIds, pushByUserId);
}
