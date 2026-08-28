import { prisma } from '../../lib/prisma.js';
import type { StaffAppPushPayload, CsPushVariant } from '../../lib/staffAppPush.helpers.js';
import {
  buildCsPushPayload,
  buildOrderFormSubmitPushPayload,
  buildScheduleAlertPushPayload,
} from '../../lib/staffAppPush.helpers.js';
import { notifyInboxRefresh } from './inboxNotify.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import { buildPushByUserIdForUsers } from '../notifications/staffAppPushDispatch.helpers.js';
import type { ScheduleAlertKind } from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';

export type CsPushContext = {
  variant: CsPushVariant;
  customerName: string;
};

/** 재직 중 ADMIN만 — 발주서 접수 등 관리자 전용 알림 */
export async function getEmployedAdminUserIds(tenantId: string): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: 'ADMIN' },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

/** 고객 발주서 제출 — 발급 마케터 + ADMIN FCM */
export async function notifyOrderFormSubmitToStaff(params: {
  tenantId: string;
  inquiryId: string;
  customerName: string;
  orderFormCreatedById: string | null;
  marketerName: string;
}): Promise<void> {
  const adminIds = await getEmployedAdminUserIds(params.tenantId);
  const targetIds = [...new Set([...adminIds, ...(params.orderFormCreatedById ? [params.orderFormCreatedById] : [])])];
  if (targetIds.length === 0) return;

  const pushByUserId = await buildPushByUserIdForUsers(targetIds, (role) =>
    buildOrderFormSubmitPushPayload({
      customerName: params.customerName,
      marketerName: params.marketerName,
      inquiryId: params.inquiryId,
      role,
    }),
  );
  notifyInboxRefresh(targetIds, pushByUserId);
}

/** 일정 변경·취소 — 테넌트 재직 마케터·ADMIN 전원 FCM (행위자 제외) */
export async function notifyScheduleAlertToOfficeStaff(params: {
  tenantId: string;
  customerName: string;
  inquiryId: string;
  kind: ScheduleAlertKind;
  summary: string;
  actorId?: string | null;
}): Promise<void> {
  if (params.kind !== 'date' && params.kind !== 'cancel') return;

  const staffIds = await getEmployedStaffUserIds(params.tenantId);
  const targetIds = staffIds.filter((id) => !params.actorId || id !== params.actorId);
  if (targetIds.length === 0) return;

  const pushByUserId = await buildPushByUserIdForUsers(targetIds, (role) =>
    buildScheduleAlertPushPayload({
      customerName: params.customerName,
      inquiryId: params.inquiryId,
      kind: params.kind,
      summary: params.summary,
      role,
    }),
  );
  notifyInboxRefresh(targetIds, pushByUserId);
}

/** 재직 중 ADMIN·MARKETER — 급여·지출 등 스태프 화면용 WS 알림 대상 (테넌트 한정) */
export async function getEmployedStaffUserIds(tenantId: string): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

async function teamLeaderIdsForInquiry(inquiryId: string): Promise<string[]> {
  const rows = await prisma.assignment.findMany({
    where: { inquiryId },
    select: { teamLeaderId: true },
  });
  return [...new Set(rows.map((r) => r.teamLeaderId))];
}

async function resolveCsNotifyTenantId(
  inquiryId: string | null | undefined,
  tenantId?: string | null,
): Promise<string | null> {
  if (tenantId) return tenantId;
  const id = inquiryId ?? null;
  if (!id) return null;
  const inv = await prisma.inquiry.findUnique({
    where: { id },
    select: { tenantId: true },
  });
  if (inv?.tenantId) return inv.tenantId;
  const cs = await prisma.csReport.findFirst({
    where: { inquiryId: id },
    select: { tenantId: true },
    orderBy: { createdAt: 'desc' },
  });
  return cs?.tenantId ?? null;
}

async function resolvePushByUserId(
  userIds: string[],
  pushByUserId: Record<string, StaffAppPushPayload> | undefined,
  csPush: CsPushContext | undefined,
): Promise<Record<string, StaffAppPushPayload> | undefined> {
  if (pushByUserId) return pushByUserId;
  if (!csPush || userIds.length === 0) return undefined;
  return buildPushByUserIdForUsers(userIds, (role) =>
    buildCsPushPayload({ variant: csPush.variant, customerName: csPush.customerName, role }),
  );
}

/**
 * 접수·스케줄·배지 등 스태프 화면 무음 재조회 — ADMIN·MARKETER (+ 선택적 추가 수신자).
 */
export async function notifyStaffInboxRefresh(
  tenantId: string,
  alsoNotifyUserIds?: ReadonlyArray<string | null | undefined>,
  pushByUserId?: Record<string, StaffAppPushPayload>,
  csPush?: CsPushContext,
): Promise<void> {
  const staff = await getEmployedStaffUserIds(tenantId);
  const extra = [...(alsoNotifyUserIds ?? [])].filter((x): x is string => typeof x === 'string' && x.length > 0);
  const allIds = [...new Set([...staff, ...extra])];
  const push = await resolvePushByUserId(allIds, pushByUserId, csPush);
  notifyInboxRefresh(allIds, push);
}

/** C/S 신규·상태 변경 시 GNB 배지(관리자 미처리 건수·팀장 담당 건수) 갱신용. */
export async function notifyCsReportNavBadges(
  inquiryId: string | null | undefined,
  alsoNotifyUserIds?: ReadonlyArray<string | null | undefined>,
  tenantId?: string | null,
  csPush?: CsPushContext,
): Promise<void> {
  const scopeTenantId = await resolveCsNotifyTenantId(inquiryId, tenantId);
  const id = inquiryId ?? null;
  const leaders = id ? await teamLeaderIdsForInquiry(id) : [];
  const extra = [...(alsoNotifyUserIds ?? [])].filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (!scopeTenantId) {
    const allIds = [...new Set([...leaders, ...extra])];
    const push = await resolvePushByUserId(allIds, undefined, csPush);
    notifyInboxRefresh(allIds, push);
    return;
  }
  void notifyStaffInboxRefresh(scopeTenantId, [...leaders, ...extra], undefined, csPush);
}
