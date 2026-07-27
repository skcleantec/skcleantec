import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { kstDayRangeYmd, kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { isUserEmployedOnYmd } from '../users/userEmployment.js';
import { happyCallDeadlineEnd } from '../inquiries/happyCall.helpers.js';
import { distanceKmFromJuan } from '../inquiries/inquiryJuanDistance.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { buildOpsHourlySummary, buildOpsHourlySummaryForRange } from '../ops-analytics/opsAnalyticsHourly.service.js';
import {
  effectiveSalesDateYmd,
  getInquiryAmount,
  kstYmdAddDays,
  resolveInquiryCompanyRevenueAmount,
  SALES_AMOUNT_STATUSES,
} from './dashboardSales.helpers.js';
import { loadMarketplaceInquiryRevenueOverrideMap } from '../db-marketplace/dbMarketplaceRevenue.helpers.js';
import { buildDashboardInquiryBreakdown } from './dashboardInquiryBreakdown.service.js';
import { buildDashboardSalesBreakdown } from './dashboardSalesBreakdown.service.js';
import { buildDashboardSettlementSummary } from './dashboardSettlementSummary.service.js';

const router = Router();

router.use(authMiddleware);
router.use(requireStaffPermission('inquiry.view'));

/** 이번 달 팀장별 현장 카드 — 접수일(KST) 이번 달·취소 제외·1차 배정이 팀장인 건만 */
const HAPPY_CALL_STATS_STATUSES = [
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CS_PROCESSING',
] as const;

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

  /** 해피콜 미완 집계 — 예약일 KST ±운영 창(과거 전량 스캔 방지) */
  const happyCallWindowStartYmd = kstYmdAddDays(todayYmd, -90);
  const happyCallWindowEndYmd = kstYmdAddDays(todayYmd, 120);
  const happyCallWindowGte = new Date(`${happyCallWindowStartYmd}T00:00:00+09:00`);
  const happyCallWindowLte = new Date(`${happyCallWindowEndYmd}T23:59:59.999+09:00`);

  const todayOffDbDate = new Date(`${todayYmd}T12:00:00+09:00`);

  const [todayCount, unassignedCount, estimateConfig, inquiriesForSales, teamLeadersRaw, monthWorkloadInquiries, todayLeaderDayOffRows, rosterRestrictedMembers, rosterOnTodayRows, happyCallRows] =
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
        id: true,
        createdAt: true,
        areaPyeong: true,
        serviceTotalAmount: true,
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
      where: { group: { tenantId, isActive: true, availabilityMode: 'ROSTER' } },
      select: { teamMemberId: true },
    }),
    prisma.teamCrewGroupDayRoster.findMany({
      where: {
        date: todayOffDbDate,
        group: { tenantId, isActive: true, availabilityMode: 'ROSTER' },
      },
      select: { teamMemberId: true },
    }),
    prisma.inquiry.findMany({
      where: {
        tenantId,
        preferredDate: {
          not: null,
          gte: happyCallWindowGte,
          lte: happyCallWindowLte,
        },
        happyCallCompletedAt: null,
        status: { in: [...HAPPY_CALL_STATS_STATUSES] },
        assignments: { some: {} },
      },
      select: { preferredDate: true },
    }),
  ]);

  const pricePerPyeong = estimateConfig;

  const revenueOverrideMap = await loadMarketplaceInquiryRevenueOverrideMap(
    tenantId,
    inquiriesForSales.map((i) => i.id),
  );
  const companyRevenueForInquiry = (inq: (typeof inquiriesForSales)[number]) =>
    resolveInquiryCompanyRevenueAmount(inq, pricePerPyeong, revenueOverrideMap.get(inq.id)?.amount);

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
    .reduce((sum, i) => sum + companyRevenueForInquiry(i), 0);

  /** 이번 달 매출: 접수일(KST)이 이번 달인 건 */
  const monthSales = inquiriesForSales
    .filter((i) => effectiveSalesDateYmd(i).startsWith(kstMonthKey))
    .reduce((sum, i) => sum + companyRevenueForInquiry(i), 0);

  /** 팀장별 매출: 접수일(KST)이 이번 달인 건만 — 1차 배정 팀장에 합산 */
  const salesByTeamLeaderMap = new Map<string, { teamLeaderId: string; name: string; amount: number }>(
    teamLeaders.map((tl) => [tl.id, { teamLeaderId: tl.id, name: tl.name, amount: 0 }])
  );
  for (const inq of inquiriesForSales) {
    if (!effectiveSalesDateYmd(inq).startsWith(kstMonthKey)) continue;
    const amt = companyRevenueForInquiry(inq);
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
    dailyAmountByYmd.set(ymd, (dailyAmountByYmd.get(ymd) ?? 0) + companyRevenueForInquiry(inq));
  }
  const dailySales: { date: string; amount: number }[] = [...dailyAmountByYmd.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

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

/** 접수·예약 분석 — 지역별·월별·예약일 (대시보드 우측 패널) */
router.get('/inquiry-breakdown', async (req, res) => {
  try {
    const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const monthRaw = typeof req.query.month === 'string' ? req.query.month.trim() : undefined;
    const breakdown = await buildDashboardInquiryBreakdown(tenantId, monthRaw);
    res.json(breakdown);
  } catch (err) {
    console.error('[dashboard/inquiry-breakdown]', err);
    const msg = err instanceof Error ? err.message : '접수 분석 통계를 불러오지 못했습니다.';
    res.status(500).json({ error: msg });
  }
});

/** 매출 상세 — 월별 일별·팀장별 (대시보드 drill-down) */
router.get('/sales-breakdown', async (req, res) => {
  try {
    const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const monthRaw = typeof req.query.month === 'string' ? req.query.month.trim() : undefined;
    const breakdown = await buildDashboardSalesBreakdown(tenantId, monthRaw);
    res.json(breakdown);
  } catch (err) {
    console.error('[dashboard/sales-breakdown]', err);
    const msg = err instanceof Error ? err.message : '매출 통계를 불러오지 못했습니다.';
    res.status(500).json({ error: msg });
  }
});

/** 팀장 정산 요약 — 예약일(KST) 월 기준 (대시보드 drill-down) */
router.get('/settlement-summary', async (req, res) => {
  try {
    const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const monthRaw = typeof req.query.month === 'string' ? req.query.month.trim() : undefined;
    const summary = await buildDashboardSettlementSummary(tenantId, monthRaw);
    res.json(summary);
  } catch (err) {
    console.error('[dashboard/settlement-summary]', err);
    const msg = err instanceof Error ? err.message : '정산 통계를 불러오지 못했습니다.';
    res.status(500).json({ error: msg });
  }
});

/** 운영 시간대 — 테넌트별 KST 시간·피크 (발주 발급 등) */
router.get('/ops-hourly', async (req, res) => {
  try {
    const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const fromYmd = typeof req.query.fromYmd === 'string' ? req.query.fromYmd.trim() : '';
    const toYmd = typeof req.query.toYmd === 'string' ? req.query.toYmd.trim() : '';
    const summary =
      fromYmd && toYmd
        ? await buildOpsHourlySummaryForRange(tenantId, fromYmd, toYmd)
        : await buildOpsHourlySummary(tenantId, req.query.days);
    res.json(summary);
  } catch (err) {
    console.error('[dashboard/ops-hourly]', err);
    const msg = err instanceof Error ? err.message : '운영 시간대 통계를 불러오지 못했습니다.';
    res.status(500).json({ error: msg });
  }
});

export default router;
