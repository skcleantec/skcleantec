import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
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

/** 접수 등록자(createdById) 기준. 과거 데이터는 orderForm.createdById로 보조 */
export function whereInquiryAttributedToMarketer(marketerId: string): Prisma.InquiryWhereInput {
  return {
    OR: [
      { createdById: marketerId },
      {
        createdById: null,
        orderForm: { is: { createdById: marketerId } },
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

  const marketers = await prisma.user.findMany({
    where: { role: 'MARKETER', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

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
