import { prisma } from '../../lib/prisma.js';
import { sendWebPushToUserIds } from './webPushSender.js';

type AssignmentRef = { teamLeaderId: string };

/** 접수 저장 후: 신규 배정 팀장에게 배정 알림, 비배정 변경 줄이 있으면 현재 담당 전원에게 변경 알림 */
export async function notifyAfterInquiryPatch(params: {
  inquiryBefore: { assignments: AssignmentRef[] };
  inquiryAfter: {
    id: string;
    inquiryNumber: string | null;
    customerName: string;
    assignments: AssignmentRef[];
  };
  lines: string[];
}): Promise<void> {
  const { inquiryBefore, inquiryAfter, lines } = params;
  const beforeSet = new Set(inquiryBefore.assignments.map((a) => a.teamLeaderId));
  const afterIds = inquiryAfter.assignments.map((a) => a.teamLeaderId);
  const newAssignees = afterIds.filter((id) => !beforeSet.has(id));
  const label = inquiryAfter.inquiryNumber ?? inquiryAfter.id.slice(0, 8);
  const url = '/team/schedule';

  if (newAssignees.length > 0) {
    await sendWebPushToUserIds(newAssignees, {
      title: 'SK클린텍 · 배정',
      body: `접수 ${label} · ${inquiryAfter.customerName}님 배정되었습니다.`,
      url,
    });
  }

  const nonTeamLines = lines.filter((l) => !l.startsWith('팀장 배정'));
  const uniqueAfter = [...new Set(afterIds)];
  if (nonTeamLines.length > 0 && uniqueAfter.length > 0) {
    const summary = nonTeamLines.join(' · ').slice(0, 180);
    await sendWebPushToUserIds(uniqueAfter, {
      title: 'SK클린텍 · 접수 변경',
      body: `접수 ${label} · ${summary}`,
      url,
    });
  }
}

/** POST /api/assignments 단일 배정 등 직접 배정 API용 */
export async function notifyNewAssignmentForInquiry(inquiryId: string, newTeamLeaderIds: string[]): Promise<void> {
  if (newTeamLeaderIds.length === 0) return;
  const inv = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, inquiryNumber: true, customerName: true },
  });
  if (!inv) return;
  const label = inv.inquiryNumber ?? inv.id.slice(0, 8);
  await sendWebPushToUserIds(newTeamLeaderIds, {
    title: 'SK클린텍 · 배정',
    body: `접수 ${label} · ${inv.customerName}님 배정되었습니다.`,
    url: '/team/schedule',
  });
}
