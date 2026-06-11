import { prisma } from '../../lib/prisma.js';
import { broadcastJsonToStaff } from '../realtime/realtimeHub.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { getEmployedStaffUserIds } from '../realtime/navBadgeNotify.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { REVIEW_PAYBACK_LOG_PREFIX, REVIEW_PAYBACK_WS_TYPE } from './reviewPayback.constants.js';

export type ReviewPaybackWsPayload = {
  type: typeof REVIEW_PAYBACK_WS_TYPE;
  requestId: string;
  customerName: string;
  orderFormId: string;
  inquiryId: string | null;
  summary: string;
};

/** 신규 페이백 신청 — WS 토스트 + GNB 배지 갱신 + (접수 연결 시) 변경 이력 */
export async function notifyReviewPaybackSubmitted(params: {
  tenantId: string;
  requestId: string;
  customerName: string;
  orderFormId: string;
  inquiryId: string | null;
}): Promise<void> {
  const summary = `${REVIEW_PAYBACK_LOG_PREFIX} ${params.customerName}님 리뷰 페이백 신청`;
  const payload: ReviewPaybackWsPayload = {
    type: REVIEW_PAYBACK_WS_TYPE,
    requestId: params.requestId,
    customerName: params.customerName,
    orderFormId: params.orderFormId,
    inquiryId: params.inquiryId,
    summary,
  };
  broadcastJsonToStaff(payload, params.tenantId);

  const staff = await getEmployedStaffUserIds(params.tenantId);
  if (staff.length > 0) notifyInboxRefresh(staff);

  if (params.inquiryId) {
    await prisma.inquiryChangeLog.create({
      data: {
        inquiryId: params.inquiryId,
        customerName: params.customerName,
        actorId: null,
        lines: [summary],
      },
    });
    notifyChangeLogToStaff({
      tenantId: params.tenantId,
      customerName: params.customerName,
      inquiryId: params.inquiryId,
      lines: [summary],
    });
  }
}

/** 상태 변경 등 — 배지·목록 무음 갱신 */
export async function notifyReviewPaybackListRefresh(tenantId: string): Promise<void> {
  const staff = await getEmployedStaffUserIds(tenantId);
  if (staff.length > 0) notifyInboxRefresh(staff);
}
