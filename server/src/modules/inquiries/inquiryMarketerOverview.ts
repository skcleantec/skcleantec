import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';
import { kstDayRangeYmd, kstMonthRangeYm, kstTodayYmd } from './inquiryListDateRange.js';
import {
  countMarketerConfirmedSubmissionsInRange,
  submittedAtYmdKst,
} from '../advertising/advertising.bookingDenominator.js';

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

/** KST yyyy-mm-dd — 접수 등록일(createdAt) */
function inquiryCreatedAtYmdKst(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/**
 * 전화·수기 등 발주서 고객 제출 없이 예약완료(RECEIVED)된 접수.
 * 발주서 제출 건(submittedAt 있음)과 이중 집계되지 않도록 제외한다.
 */
function whereManualReceivedInquiryBase(): Prisma.InquiryWhereInput {
  return {
    status: 'RECEIVED',
    createdById: { not: null },
    OR: [{ orderFormId: null }, { orderForm: { is: { submittedAt: null } } }],
  };
}

/** 기간 내 마케터별 전화·수기 예약완료 건수(접수일 createdAt KST) */
async function countManualReceivedByMarketerInRange(
  tenantId: string,
  rangeGte: Date,
  rangeLte: Date,
): Promise<Map<string, number>> {
  const rows = await prisma.inquiry.findMany({
    where: {
      tenantId,
      createdAt: { gte: rangeGte, lte: rangeLte },
      ...whereManualReceivedInquiryBase(),
    },
    select: { createdById: true },
  });
  const out = new Map<string, number>();
  for (const row of rows) {
    if (!row.createdById) continue;
    out.set(row.createdById, (out.get(row.createdById) ?? 0) + 1);
  }
  return out;
}

/**
 * 마케터 일별·오늘 집계와 동일한 접수 목록 필터 (KST 하루).
 * - 발주서 고객 제출: orderForm.createdById + submittedAt
 * - 전화·수기 예약완료: inquiry.createdById + createdAt, 발주서 미제출
 */
export function whereMarketerStatsInquiriesOnDay(
  marketerId: string,
  dayYmd: string,
): Prisma.InquiryWhereInput | null {
  const dayRange = kstDayRangeYmd(dayYmd);
  if (!dayRange) return null;
  return {
    OR: [
      {
        createdById: marketerId,
        status: 'RECEIVED',
        createdAt: { gte: dayRange.gte, lte: dayRange.lte },
        OR: [{ orderFormId: null }, { orderForm: { is: { submittedAt: null } } }],
      },
      {
        status: { not: 'CANCELLED' },
        orderForm: {
          is: {
            createdById: marketerId,
            submittedAt: { gte: dayRange.gte, lte: dayRange.lte },
          },
        },
      },
    ],
  };
}

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

/**
 * 마케터별 이번 달·오늘 확정 예약완료
 * - 발주서 고객 제출: submittedAt(KST)
 * - 전화·수기 예약완료: 접수 등록일 createdAt(KST), 발주서 미제출
 */
export async function buildMarketerOverview(tenantId: string): Promise<MarketerOverviewResult> {
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
    where: { tenantId, role: { in: ['MARKETER', 'ADMIN'] }, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  /** 개발용 team-preview 관리자 계정은 집계·필터 대상에서 제외 */
  const marketers = staff.filter((u) => !isTeamPreviewAdminEmail(u.email));

  const [monthManualByUser, todayManualByUser] = await Promise.all([
    countManualReceivedByMarketerInRange(tenantId, monthRange.gte, monthRange.lte),
    countManualReceivedByMarketerInRange(tenantId, todayRange.gte, todayRange.lte),
  ]);

  const rows: MarketerOverviewRow[] = await Promise.all(
    marketers.map(async (m) => {
      const [monthBreakdown, todayBreakdown] = await Promise.all([
        countMarketerConfirmedSubmissionsInRange(
          prisma,
          tenantId,
          m.id,
          monthRange.gte,
          monthRange.lte,
        ),
        countMarketerConfirmedSubmissionsInRange(
          prisma,
          tenantId,
          m.id,
          todayRange.gte,
          todayRange.lte,
        ),
      ]);
      return {
        marketerId: m.id,
        name: m.name,
        monthCount:
          monthBreakdown.activeCount + (monthManualByUser.get(m.id) ?? 0),
        todayCount:
          todayBreakdown.activeCount + (todayManualByUser.get(m.id) ?? 0),
      };
    }),
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
  /** index 0 = 1일 — 확정 예약완료(발주서 제출일 또는 전화·수기 접수일, KST) */
  dailyCounts: number[];
  monthTotal: number;
};

/** 마케터별 월간 일별 확정 예약완료 (발주서 submittedAt + 전화·수기 createdAt, KST) */
export async function buildMarketerDailyOverview(
  tenantId: string,
  marketerId: string,
  monthKey: string,
): Promise<MarketerDailyOverviewResult | null> {
  const monthRange = kstMonthRangeYm(monthKey);
  if (!monthRange) return null;

  const user = await prisma.user.findFirst({
    where: { id: marketerId, tenantId, role: { in: ['MARKETER', 'ADMIN'] }, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!user || isTeamPreviewAdminEmail(user.email)) return null;

  const y = Number(monthKey.slice(0, 4));
  const mo = Number(monthKey.slice(5, 7));
  const daysInMonth = new Date(y, mo, 0).getDate();

  const [forms, manualInquiries] = await Promise.all([
    prisma.orderForm.findMany({
      where: {
        tenantId,
        createdById: marketerId,
        submittedAt: { gte: monthRange.gte, lte: monthRange.lte },
      },
      select: {
        submittedAt: true,
        inquiries: {
          select: { status: true },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
      },
    }),
    prisma.inquiry.findMany({
      where: {
        tenantId,
        createdById: marketerId,
        createdAt: { gte: monthRange.gte, lte: monthRange.lte },
        ...whereManualReceivedInquiryBase(),
      },
      select: { createdAt: true },
    }),
  ]);

  const dailyCounts = Array.from({ length: daysInMonth }, () => 0);
  let monthTotal = 0;

  for (const row of forms) {
    if (!row.submittedAt) continue;
    if (row.inquiries.length > 0 && row.inquiries[0]!.status === 'CANCELLED') continue;
    if (row.inquiries.length === 0) continue;
    const ymd = submittedAtYmdKst(row.submittedAt);
    if (!ymd.startsWith(monthKey)) continue;
    const dom = Number(ymd.slice(8, 10));
    if (dom < 1 || dom > daysInMonth) continue;
    dailyCounts[dom - 1]! += 1;
    monthTotal += 1;
  }

  for (const row of manualInquiries) {
    const ymd = inquiryCreatedAtYmdKst(row.createdAt);
    if (!ymd.startsWith(monthKey)) continue;
    const dom = Number(ymd.slice(8, 10));
    if (dom < 1 || dom > daysInMonth) continue;
    dailyCounts[dom - 1]! += 1;
    monthTotal += 1;
  }

  return {
    marketerId: user.id,
    marketerName: user.name,
    monthKey,
    daysInMonth,
    dailyCounts,
    monthTotal,
  };
}
