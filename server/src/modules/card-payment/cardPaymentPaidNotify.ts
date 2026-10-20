import { prisma } from '../../lib/prisma.js';
import type { StaffAppPushPayload } from '../../lib/staffAppPush.helpers.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { broadcastJsonToStaff, sendJsonToUser } from '../realtime/realtimeHub.js';

function wonLabel(amountWon: number) {
  return `${Math.round(amountWon).toLocaleString('ko-KR')}원`;
}

/** 카드결재 승인 후 팀장 목록을 갱신하고, 인증결제면 팀장·관리자에게 바로 알린다. */
export async function notifyCardPaymentApproved(tenantId: string, inquiryId: string | null) {
  if (!inquiryId) return;
  const [payment, assignments, staff] = await Promise.all([
    prisma.cardPayment.findFirst({
      where: { tenantId, inquiryId, status: 'APPROVED', method: 'CUSTOMER_LINK' },
      orderBy: { paidAt: 'desc' },
      select: { amountWon: true, customerName: true, inquiryNumber: true },
    }),
    prisma.assignment.findMany({
      where: { tenantId, inquiryId },
      select: { teamLeaderId: true },
    }),
    prisma.user.findMany({
      where: { tenantId, isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
      select: { id: true, role: true },
    }),
  ]);

  const leaderIds = [...new Set(assignments.map((row) => row.teamLeaderId).filter(Boolean))];
  const refreshIds = payment ? [...leaderIds, ...staff.map((row) => row.id)] : leaderIds;
  if (refreshIds.length === 0 && !payment) return;

  const payload = payment
    ? {
        type: 'card-payment:approved' as const,
        inquiryId,
        customerName: payment.customerName,
        inquiryNumber: payment.inquiryNumber,
        amountWon: payment.amountWon,
      }
    : null;

  if (payload) {
    for (const id of leaderIds) sendJsonToUser(id, payload, tenantId);
    broadcastJsonToStaff(payload, tenantId);
  }

  const pushByUserId: Record<string, StaffAppPushPayload> = {};
  if (payment) {
    const body = `${payment.customerName.trim() || '고객'} 고객님 ${wonLabel(payment.amountWon)} 결제되었습니다. 철수하셔도 됩니다.`;
    for (const id of leaderIds) {
      pushByUserId[id] = {
        kind: 'schedule_alert',
        title: '카드결재 완료',
        body,
        path: '/team/schedule',
      };
    }
    for (const row of staff) {
      if (row.role !== 'ADMIN') continue;
      pushByUserId[row.id] = {
        kind: 'schedule_alert',
        title: '카드결재 완료',
        body,
        path: `/admin/inquiries?openInquiry=${encodeURIComponent(inquiryId)}`,
      };
    }
  }

  if (refreshIds.length > 0) {
    await notifyInboxRefresh(refreshIds, Object.keys(pushByUserId).length > 0 ? pushByUserId : undefined);
  }
}
