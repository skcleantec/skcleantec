import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import { kstDayRangeYmd, kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { isUserEmployedOnYmd } from '../users/userEmployment.js';
import { happyCallDeadlineEnd } from '../inquiries/happyCall.helpers.js';
import { distanceKmFromJuan } from '../inquiries/inquiryJuanDistance.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOrMarketer);

/**
 * 대시보드 매출 금액·그래프 대상 상태.
 * - 고객이 확정한(접수 완료된) 건만 매출로 본다.
 * - PENDING(대기·마케터 선접수, 고객 미제출)·ORDER_FORM_PENDING(발급 후 미제출)은 제외 → 미확정 발주금액이 매출에 섞이지 않게 한다.
 */
const SALES_AMOUNT_STATUSES = [
  'RECEIVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CS_PROCESSING',
  'ON_HOLD',
] as const;

/** 이번 달 팀장별 현장 카드 — 접수일(KST) 이번 달·취소 제외·1차 배정이 팀장인 건만 */
const HAPPY_CALL_STATS_STATUSES = [
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CS_PROCESSING',
] as const;

/**
 * 접수 1건의 매출 금액 = 발주총액(없으면 평수×단가) + 추가청소(extraCharges) 합.
 * extraCharges.amount 는 음수면 할인 — 스케줄·정산과 동일 기준.
 */
function getInquiryAmount(
  inq: {
    orderForm?: { totalAmount: number } | null;
    areaPyeong: number | null;
    extraCharges?: { amount: number }[] | null;
  },
  pricePerPyeong: number,
): number {
  const base =
    inq.orderForm?.totalAmount != null
      ? inq.orderForm.totalAmount
      : inq.areaPyeong != null && inq.areaPyeong > 0
        ? Math.round(inq.areaPyeong * pricePerPyeong)
        : 0;
  const extra = inq.extraCharges?.reduce((sum, c) => sum + (c.amount ?? 0), 0) ?? 0;
  return base + extra;
}

/** 매출 기준일(KST): 접수일(createdAt) 기준으로 통일 */
function effectiveSalesDateYmd(inquiry: { createdAt: Date }): string {
  return inquiry.createdAt.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** KST 날짜(YYYY-MM-DD)에 일수 더하기 */
function kstYmdAddDays(ymd: string, deltaDays: number): string {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

router.get('/stats', async (req, res) => {
  try {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  /** 오늘 접수: 서비스접수 `datePreset=today`와 동일 — 접수일(createdAt) KST 하루 */
  const todayYmd = kstTodayYmd();
  const kstTodayRange = kstDayRangeYmd(todayYmd);
  if (!kstTodayRange) {
    res.status(500).json({ error: '오늘 구간을 계산할 수 없습니다.' });
    return;
  }

  /** 이번 달 미분배: 접수일(createdAt) KST 기준 이번 달 + 상태 RECEIVED */
  const kstMonthKey = todayYmd.slice(0, 7);
  const kstThisMonth = kstMonthRangeYm(kstMonthKey);
  if (!kstThisMonth) {
    res.status(500).json({ error: '이번 달 구간을 계산할 수 없습니다.' });
    return;
  }

  /**
   * 매출 집계용 접수 조회 구간(KST 접수일 기준) — 전체 스캔 방지.
   * 오늘·이번 달·최근 7일·팀장별(이번 달)을 모두 덮으려면
   * 「이번 달 1일」과 「오늘 -6일」 중 더 이른 날부터 조회하면 충분하다.
   */
  const monthStartYmd = `${kstMonthKey}-01`;
  const sevenDaysAgoYmd = kstYmdAddDays(todayYmd, -6);
  const salesWindowStartYmd = sevenDaysAgoYmd < monthStartYmd ? sevenDaysAgoYmd : monthStartYmd;
  const salesWindowGte = new Date(`${salesWindowStartYmd}T00:00:00+09:00`);

  const todayOffDbDate = new Date(`${todayYmd}T12:00:00+09:00`);

  const [todayCount, unassignedCount, estimateConfig, inquiriesForSales, teamLeadersRaw, monthWorkloadInquiries, todayLeaderDayOffRows, rosterRestrictedMembers, rosterOnTodayRows] =
    await Promise.all([
    prisma.inquiry.count({
      where: {
        tenantId,
        createdAt: { gte: kstTodayRange.gte, lte: kstTodayRange.lte },
      },
    }),
    prisma.inquiry.count({
      where: {
        tenantId,
        status: { in: ['RECEIVED', 'DEPOSIT_PENDING', 'DEPOSIT_COMPLETED'] },
        createdAt: { gte: kstThisMonth.gte, lte: kstThisMonth.lte },
      },
    }),
    prisma.estimateConfig.findUnique({ where: { tenantId } }).then((c) => c?.pricePerPyeong ?? 5000),
    prisma.inquiry.findMany({
      where: {
        tenantId,
        status: { in: [...SALES_AMOUNT_STATUSES] },
        createdAt: { gte: salesWindowGte },
      },
      select: {
        createdAt: true,
        areaPyeong: true,
        orderForm: { select: { totalAmount: true } },
        extraCharges: { select: { amount: true } },
        assignments: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { teamLeader: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { tenantId, role: 'TEAM_LEADER', isActive: true },
      select: { id: true, name: true, hireDate: true, resignationDate: true },
    }),
    prisma.inquiry.findMany({
      where: {
        tenantId,
        createdAt: { gte: kstThisMonth.gte, lte: kstThisMonth.lte },
        status: { not: 'CANCELLED' },
        assignments: {
          some: {
            teamLeader: { role: 'TEAM_LEADER' },
          },
        },
      },
      select: {
        addressGeoLat: true,
        addressGeoLng: true,
        assignments: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: {
            teamLeaderId: true,
            teamLeader: { select: { id: true, role: true } },
          },
        },
      },
    }),
    prisma.userDayOff.findMany({
      where: {
        date: todayOffDbDate,
        teamLeader: { tenantId, role: 'TEAM_LEADER', isActive: true },
      },
      select: {
        teamLeaderId: true,
        teamLeader: { select: { id: true, name: true, hireDate: true, resignationDate: true } },
      },
    }),
    prisma.teamCrewGroupMember.findMany({
      where: { group: { tenantId, isActive: true, useDailyRosterOnly: true } },
      select: { teamMemberId: true },
    }),
    prisma.teamCrewGroupDayRoster.findMany({
      where: {
        date: todayOffDbDate,
        group: { tenantId, isActive: true, useDailyRosterOnly: true },
      },
      select: { teamMemberId: true },
    }),
  ]);

  const pricePerPyeong = estimateConfig;

  const teamLeaders = teamLeadersRaw.filter((tl) =>
    isUserEmployedOnYmd(tl.hireDate, tl.resignationDate, todayYmd)
  );

  /** 이번 달 팀장별 현장 건수·주안 거리: 접수일(KST) 이번 달·취소 제외·1차 배정 팀장 — km은 좌표 있는 배정 건의 누적합·최댓값 */
  const tlEmployedIds = new Set(teamLeaders.map((t) => t.id));
  const tlNameById = new Map(teamLeaders.map((t) => [t.id, t.name]));
  const workloadAgg = new Map<string, { jobCount: number; maxKm: number; sumKm: number }>();
  for (const row of monthWorkloadInquiries) {
    const a = row.assignments[0];
    if (!a || a.teamLeader.role !== 'TEAM_LEADER') continue;
    if (!tlEmployedIds.has(a.teamLeaderId)) continue;
    const km = distanceKmFromJuan(row.addressGeoLat, row.addressGeoLng);
    const cur = workloadAgg.get(a.teamLeaderId) ?? { jobCount: 0, maxKm: 0, sumKm: 0 };
    cur.jobCount += 1;
    if (km != null) {
      cur.maxKm = Math.max(cur.maxKm, km);
      cur.sumKm += km;
    }
    workloadAgg.set(a.teamLeaderId, cur);
  }
  const teamLeaderWorkloadThisMonth = [...workloadAgg.entries()]
    .map(([teamLeaderId, v]) => ({
      teamLeaderId,
      name: tlNameById.get(teamLeaderId) ?? '',
      jobCount: v.jobCount,
      maxKmFromJuan: Math.round(v.maxKm * 10) / 10,
      sumKmFromJuan: Math.round(v.sumKm * 10) / 10,
    }))
    .filter((w) => w.jobCount > 0)
    .sort((a, b) => b.jobCount - a.jobCount);

  /** 오늘 팀장 휴무 (재직 중만) */
  const teamLeaderDayOffToday = todayLeaderDayOffRows
    .filter((r) =>
      isUserEmployedOnYmd(r.teamLeader.hireDate, r.teamLeader.resignationDate, todayYmd)
    )
    .map((r) => ({ teamLeaderId: r.teamLeaderId, name: r.teamLeader.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  /** 오늘 일일 명단(useDailyRosterOnly)에 포함되지 않은 팀원 = 조장 명단에서 제외 → 당일 배정 후보에서 빠짐 */
  const rosterRestrictedIds = new Set(rosterRestrictedMembers.map((r) => r.teamMemberId));
  const rosterOnTodayIds = new Set(rosterOnTodayRows.map((r) => r.teamMemberId));
  const restingRosterMemberIds = [...rosterRestrictedIds].filter((id) => !rosterOnTodayIds.has(id));
  let teamMembersDailyRosterRestToday: { teamMemberId: string; name: string }[] = [];
  if (restingRosterMemberIds.length > 0) {
    teamMembersDailyRosterRestToday = (
      await prisma.teamMember.findMany({
        where: { id: { in: restingRosterMemberIds }, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    ).map((m) => ({ teamMemberId: m.id, name: m.name }));
  }
  const dailyRosterModeActive = rosterRestrictedIds.size > 0;

  /** 오늘 매출: 접수일(KST)이 오늘인 건 */
  const todaySales = inquiriesForSales
    .filter((i) => effectiveSalesDateYmd(i) === todayYmd)
    .reduce((sum, i) => sum + getInquiryAmount(i, pricePerPyeong), 0);

  /** 이번 달 매출: 접수일(KST)이 이번 달인 건 */
  const monthSales = inquiriesForSales
    .filter((i) => effectiveSalesDateYmd(i).startsWith(kstMonthKey))
    .reduce((sum, i) => sum + getInquiryAmount(i, pricePerPyeong), 0);

  /** 팀장별 매출: 접수일(KST)이 이번 달인 건만 — 1차 배정 팀장에 합산 */
  const salesByTeamLeaderMap = new Map<string, { teamLeaderId: string; name: string; amount: number }>(
    teamLeaders.map((tl) => [tl.id, { teamLeaderId: tl.id, name: tl.name, amount: 0 }])
  );
  for (const inq of inquiriesForSales) {
    if (!effectiveSalesDateYmd(inq).startsWith(kstMonthKey)) continue;
    const amt = getInquiryAmount(inq, pricePerPyeong);
    if (amt <= 0) continue;
    const assigned = (inq as { assignments?: { teamLeader: { id: string; name: string } }[] }).assignments?.[0]?.teamLeader;
    if (!assigned) continue;
    const entry = salesByTeamLeaderMap.get(assigned.id);
    if (entry) entry.amount += amt;
  }
  const salesByTeamLeader = [...salesByTeamLeaderMap.values()].sort((a, b) => b.amount - a.amount);

  /** 최근 7일 일별 매출 (그래프용, 접수일 KST 일자 기준) — 단일 패스로 누적 */
  const dailyAmountByYmd = new Map<string, number>();
  for (let d = 6; d >= 0; d--) dailyAmountByYmd.set(kstYmdAddDays(todayYmd, -d), 0);
  for (const inq of inquiriesForSales) {
    const ymd = effectiveSalesDateYmd(inq);
    if (!dailyAmountByYmd.has(ymd)) continue;
    dailyAmountByYmd.set(ymd, (dailyAmountByYmd.get(ymd) ?? 0) + getInquiryAmount(inq, pricePerPyeong));
  }
  const dailySales: { date: string; amount: number }[] = [...dailyAmountByYmd.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const happyCallRows = await prisma.inquiry.findMany({
    where: {
      tenantId,
      preferredDate: { not: null },
      happyCallCompletedAt: null,
      status: { in: [...HAPPY_CALL_STATS_STATUSES] },
      assignments: { some: {} },
    },
    select: { preferredDate: true },
  });
  const nowTs = new Date();
  let happyCallOverdueCount = 0;
  let happyCallPendingBeforeDeadlineCount = 0;
  for (const r of happyCallRows) {
    if (!r.preferredDate) continue;
    if (nowTs > happyCallDeadlineEnd(r.preferredDate)) happyCallOverdueCount++;
    else happyCallPendingBeforeDeadlineCount++;
  }

  res.json({
    todayCount,
    unassignedCount,
    todaySales,
    monthSales,
    salesByTeamLeader,
    dailySales,
    happyCallOverdueCount,
    happyCallPendingBeforeDeadlineCount,
    teamLeaderWorkloadThisMonth,
    teamLeaderDayOffToday,
    teamMembersDailyRosterRestToday,
    dailyRosterModeActive,
  });
  } catch (err) {
    console.error('[dashboard/stats]', err);
    const msg =
      err instanceof Error ? err.message : '대시보드 통계를 불러오지 못했습니다.';
    res.status(500).json({
      error:
        msg.includes('ON_HOLD') || msg.includes('inquiry_status') || msg.includes('InquiryStatus')
          ? 'DB 스키마가 코드보다 낮을 수 있습니다. server 에서 `npx prisma migrate deploy`(또는 로컬 `migrate dev`) 후 다시 시도해 주세요.'
          : msg,
    });
  }
});

export default router;
