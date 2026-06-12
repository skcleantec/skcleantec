import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from './inboxNotify.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';

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

/**
 * 접수·스케줄·배지 등 스태프 화면 무음 재조회 — ADMIN·MARKETER (+ 선택적 추가 수신자).
 * `inbox:refresh` 로 클라이언트가 목록·캘린더를 다시 불러오게 한다.
 */
export async function notifyStaffInboxRefresh(
  tenantId: string,
  alsoNotifyUserIds?: ReadonlyArray<string | null | undefined>,
): Promise<void> {
  const staff = await getEmployedStaffUserIds(tenantId);
  const extra = [...(alsoNotifyUserIds ?? [])].filter((x): x is string => typeof x === 'string' && x.length > 0);
  notifyInboxRefresh([...new Set([...staff, ...extra])]);
}

/** C/S 신규·상태 변경 시 GNB 배지(관리자 미처리 건수·팀장 담당 건수) 갱신용. */
export async function notifyCsReportNavBadges(
  inquiryId: string | null | undefined,
  alsoNotifyUserIds?: ReadonlyArray<string | null | undefined>,
  tenantId?: string | null,
): Promise<void> {
  const scopeTenantId = await resolveCsNotifyTenantId(inquiryId, tenantId);
  const id = inquiryId ?? null;
  const leaders = id ? await teamLeaderIdsForInquiry(id) : [];
  const extra = [...(alsoNotifyUserIds ?? [])].filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (!scopeTenantId) {
    notifyInboxRefresh([...new Set([...leaders, ...extra])]);
    return;
  }
  void notifyStaffInboxRefresh(scopeTenantId, [...leaders, ...extra]);
}
