import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';
import { dateToYmdKst } from '../users/userEmployment.js';
import { kstDayRangeYmd, kstMonthRangeYm, kstTodayYmd } from './inquiryListDateRange.js';

export type MarketerOverviewRow = {
  marketerId: string;
  name: string;
  monthCount: number;
  todayCount: number;
};

export type MarketerOverviewResult = {
  /** 현재 집계 기준 연월 YYYY-MM (KST) */
  monthKey: string;
  /** 오늘 날짜 YYYY-MM-DD (KST) */
  todayYmd: string;
  marketers: MarketerOverviewRow[];
};

/** 접수 등록자(createdById) 기준. 과거 데이터는 orderForm.createdById로 보조. 미제출(링크만 발급)은 발주서 작성자도 동일 건으로 본다 */
export function whereInquiryAttributedToMarketer(marketerId: string): Prisma.InquiryWhereInput {
  return {
    OR: [
      { createdById: marketerId },
      {
        createdById: null,
        orderForm: { is: { createdById: marketerId } },
      },
      {
        status: 'ORDER_FORM_PENDING',
        orderForm: {
          is: {
            createdById: marketerId,
            submittedAt: null,
          },
        },
      },
    ],
  };
}

/** 마케터별 이번 달·오늘 접수 건수 (접수일 createdAt, KST) */
export async function buildMarketerOverview(): Promise<MarketerOverviewResult> {
  const todayYmd = kstTodayYmd();
  const monthKey = todayYmd.slice(0, 7);
  const monthRange = kstMonthRangeYm(monthKey);
  const todayRange = kstDayRangeYmd(todayYmd);
  if (!monthRange || !todayRange) {
    return {
      monthKey,
      todayYmd,
      marketers: [],
    };
  }

  const staff = await prisma.user.findMany({
    where: { role: { in: ['MARKETER', 'ADMIN'] }, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  /** 개발용 team-preview 관리자 계정은 집계·필터 대상에서 제외 */
  const marketers = staff.filter((u) => !isTeamPreviewAdminEmail(u.email));

  const rows: MarketerOverviewRow[] = await Promise.all(
    marketers.map(async (m) => {
      const attr = whereInquiryAttributedToMarketer(m.id);
      const [monthCount, todayCount] = await Promise.all([
        prisma.inquiry.count({
          where: {
            createdAt: { gte: monthRange.gte, lte: monthRange.lte },
            ...attr,
          },
        }),
        prisma.inquiry.count({
          where: {
            createdAt: { gte: todayRange.gte, lte: todayRange.lte },
            ...attr,
          },
        }),
      ]);
      return { marketerId: m.id, name: m.name, monthCount, todayCount };
    })
  );

  return {
    monthKey,
    todayYmd,
    marketers: rows,
  };
}

export type MarketerDailyOverviewResult = {
  marketerId: string;
  marketerName: string;
  monthKey: string;
  daysInMonth: number;
  /** index 0 = 1일 */
  dailyCounts: number[];
  monthTotal: number;
};

/** 마케터별 월간 일별 접수 건수 (접수일 createdAt, KST) */
export async function buildMarketerDailyOverview(
  marketerId: string,
  monthKey: string
): Promise<MarketerDailyOverviewResult | null> {
  const monthRange = kstMonthRangeYm(monthKey);
  if (!monthRange) return null;

  const user = await prisma.user.findFirst({
    where: { id: marketerId, role: { in: ['MARKETER', 'ADMIN'] }, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!user || isTeamPreviewAdminEmail(user.email)) return null;

  const y = Number(monthKey.slice(0, 4));
  const mo = Number(monthKey.slice(5, 7));
  const daysInMonth = new Date(y, mo, 0).getDate();
  const dailyCounts = new Array<number>(daysInMonth).fill(0);

  const rows = await prisma.inquiry.findMany({
    where: {
      createdAt: { gte: monthRange.gte, lte: monthRange.lte },
      ...whereInquiryAttributedToMarketer(marketerId),
    },
    select: { createdAt: true },
  });

  for (const row of rows) {
    const ymd = dateToYmdKst(row.createdAt);
    if (!ymd.startsWith(monthKey)) continue;
    const day = Number(ymd.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) dailyCounts[day - 1] += 1;
  }

  return {
    marketerId: user.id,
    marketerName: user.name,
    monthKey,
    daysInMonth,
    dailyCounts,
    monthTotal: dailyCounts.reduce((sum, n) => sum + n, 0),
  };
}
