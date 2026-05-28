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
 * C/S 신규·상태 변경 시 GNB 배지(관리자 미처리 건수·팀장 담당 건수) 갱신용.
 * `inbox:refresh` 와 동일 채널로 보내 클라이언트가 GET /nav-badges 를 다시 호출하게 함.
 */
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
  const staff = await getEmployedStaffUserIds(scopeTenantId);
  notifyInboxRefresh([...new Set([...staff, ...leaders, ...extra])]);
}
