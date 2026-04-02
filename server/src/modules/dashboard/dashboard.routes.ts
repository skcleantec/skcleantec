import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import { kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOrMarketer);

/** 매출 집계 대상: 청소 완료·진행중 건 */
const SALES_STATUS = ['COMPLETED', 'IN_PROGRESS'] as const;

function getInquiryAmount(inq: { orderForm?: { totalAmount: number } | null; areaPyeong: number | null }, pricePerPyeong: number): number {
  if (inq.orderForm?.totalAmount != null) return inq.orderForm.totalAmount;
  if (inq.areaPyeong != null && inq.areaPyeong > 0) return Math.round(inq.areaPyeong * pricePerPyeong);
  return 0;
}

router.get('/stats', async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  /** 이번 달 미분배: 접수일(createdAt) KST 기준 이번 달 + 상태 RECEIVED */
  const kstMonthKey = kstTodayYmd().slice(0, 7);
  const kstThisMonth = kstMonthRangeYm(kstMonthKey);
  if (!kstThisMonth) {
    res.status(500).json({ error: '이번 달 구간을 계산할 수 없습니다.' });
    return;
  }

  const [todayCount, unassignedCount, estimateConfig, inquiriesForSales, teamLeaders] = await Promise.all([
    prisma.inquiry.count({
      where: {
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.inquiry.count({
      where: {
        status: 'RECEIVED',
        createdAt: { gte: kstThisMonth.gte, lte: kstThisMonth.lte },
      },
    }),
    prisma.estimateConfig.findFirst().then((c) => c?.pricePerPyeong ?? 5000),
    prisma.inquiry.findMany({
      where: { status: { in: [...SALES_STATUS] } },
      include: {
        orderForm: { select: { totalAmount: true } },
        assignments: { include: { teamLeader: { select: { id: true, name: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { role: 'TEAM_LEADER', isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  const pricePerPyeong = estimateConfig;

  /** 오늘 매출: preferredDate가 오늘인 건 */
  const todaySales = inquiriesForSales
    .filter((i) => i.preferredDate && new Date(i.preferredDate).toDateString() === today.toDateString())
    .reduce((sum, i) => sum + getInquiryAmount(i, pricePerPyeong), 0);

  /** 이번 달 매출: preferredDate가 이번 달인 건 */
  const monthSales = inquiriesForSales
    .filter((i) => i.preferredDate && new Date(i.preferredDate) >= monthStart && new Date(i.preferredDate) <= monthEnd)
    .reduce((sum, i) => sum + getInquiryAmount(i, pricePerPyeong), 0);

  /** 팀장별 매출 */
  const salesByTeamLeader: { teamLeaderId: string; name: string; amount: number }[] = teamLeaders.map((tl) => ({
    teamLeaderId: tl.id,
    name: tl.name,
    amount: 0,
  }));
  for (const inq of inquiriesForSales) {
    const amt = getInquiryAmount(inq, pricePerPyeong);
    if (amt <= 0) continue;
    const assigned = (inq as { assignments?: { teamLeader: { id: string; name: string } }[] }).assignments?.[0]?.teamLeader;
    if (assigned) {
      const entry = salesByTeamLeader.find((s) => s.teamLeaderId === assigned.id);
      if (entry) entry.amount += amt;
    }
  }
  salesByTeamLeader.sort((a, b) => b.amount - a.amount);

  /** 최근 7일 일별 매출 (그래프용) */
  const dailySales: { date: string; amount: number }[] = [];
  for (let d = 6; d >= 0; d--) {
    const dStart = new Date(today);
    dStart.setDate(dStart.getDate() - d);
    dStart.setHours(0, 0, 0, 0);
    const dEnd = new Date(dStart);
    dEnd.setHours(23, 59, 59, 999);
    const dateStr = dStart.toISOString().slice(0, 10);
    const amt = inquiriesForSales
      .filter((i) => i.preferredDate && new Date(i.preferredDate) >= dStart && new Date(i.preferredDate) <= dEnd)
      .reduce((sum, i) => sum + getInquiryAmount(i, pricePerPyeong), 0);
    dailySales.push({ date: dateStr, amount: amt });
  }

  res.json({
    todayCount,
    unassignedCount,
    todaySales,
    monthSales,
    salesByTeamLeader,
    dailySales,
  });
});

export default router;
