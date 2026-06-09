import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';
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

/** KST yyyy-mm-dd — 접수 등록일(createdAt) */
function inquiryCreatedAtYmdKst(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
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

/** 서비스접수 목록과 동일: 상태 예약완료(RECEIVED) + 접수일(createdAt KST) + 접수자 */
function whereReceivedInquiryAttributedToMarketers(
  marketerIds: string[],
): Prisma.InquiryWhereInput | null {
  if (marketerIds.length === 0) return null;
  return {
    status: 'RECEIVED',
    OR: [
      { createdById: { in: marketerIds } },
      {
        createdById: null,
        orderForm: { is: { createdById: { in: marketerIds } } },
      },
    ],
  };
}

function resolveMarketerIdForReceivedRow(row: {
  createdById: string | null;
  orderForm: { createdById: string } | null;
}): string | null {
  return row.createdById ?? row.orderForm?.createdById ?? null;
}

type ReceivedMarketerCountMaps = {
  month: Map<string, number>;
  today: Map<string, number>;
};

/** 이번 달·오늘 마케터별 RECEIVED 건수 — DB 1회 조회(월간 범위만) */
async function countReceivedInquiriesByMarketerMonthAndToday(
  tenantId: string,
  monthGte: Date,
  monthLte: Date,
  todayGte: Date,
  todayLte: Date,
  marketerIds: string[],
): Promise<ReceivedMarketerCountMaps> {
  const empty = (): ReceivedMarketerCountMaps => ({
    month: new Map(marketerIds.map((id) => [id, 0])),
    today: new Map(marketerIds.map((id) => [id, 0])),
  });
  const attr = whereReceivedInquiryAttributedToMarketers(marketerIds);
  if (!attr) return empty();

  const rows = await prisma.inquiry.findMany({
    where: {
      tenantId,
      createdAt: { gte: monthGte, lte: monthLte },
      ...attr,
    },
    select: {
      createdAt: true,
      createdById: true,
      orderForm: { select: { createdById: true } },
    },
  });

  const month = new Map<string, number>();
  const today = new Map<string, number>();
  for (const id of marketerIds) {
    month.set(id, 0);
    today.set(id, 0);
  }
  for (const row of rows) {
    const uid = resolveMarketerIdForReceivedRow(row);
    if (!uid || !month.has(uid)) continue;
    month.set(uid, (month.get(uid) ?? 0) + 1);
    const t = row.createdAt.getTime();
    if (t >= todayGte.getTime() && t <= todayLte.getTime()) {
      today.set(uid, (today.get(uid) ?? 0) + 1);
    }
  }
  return { month, today };
}

/**
 * 마케터 일별·오늘 집계와 동일한 접수 목록 필터 (KST 하루).
 * 서비스접수: 상태 RECEIVED + 접수일(createdAt) + 접수자
 */
export function whereMarketerStatsInquiriesOnDay(
  marketerId: string,
  dayYmd: string,
): Prisma.InquiryWhereInput | null {
  const dayRange = kstDayRangeYmd(dayYmd);
  if (!dayRange) return null;
  return {
    AND: [
      { status: 'RECEIVED' },
      { createdAt: { gte: dayRange.gte, lte: dayRange.lte } },
      whereInquiryAttributedToMarketer(marketerId),
    ],
  };
}

/** 마케터별 이번 달·오늘 예약완료 — 서비스접수와 동일(접수일·RECEIVED·접수자) */
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
  const marketerIds = marketers.map((m) => m.id);

  const { month: monthCounts, today: todayCounts } = await countReceivedInquiriesByMarketerMonthAndToday(
    tenantId,
    monthRange.gte,
    monthRange.lte,
    todayRange.gte,
    todayRange.lte,
    marketerIds,
  );

  const rows: MarketerOverviewRow[] = marketers.map((m) => ({
    marketerId: m.id,
    name: m.name,
    monthCount: monthCounts.get(m.id) ?? 0,
    todayCount: todayCounts.get(m.id) ?? 0,
  }));

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
  /** index 0 = 1일 — 예약완료(RECEIVED) 접수일(KST) */
  dailyCounts: number[];
  monthTotal: number;
};

/** 마케터별 월간 일별 예약완료 — 서비스접수와 동일(접수일·RECEIVED) */
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

  const rows = await prisma.inquiry.findMany({
    where: {
      tenantId,
      status: 'RECEIVED',
      createdAt: { gte: monthRange.gte, lte: monthRange.lte },
      ...whereInquiryAttributedToMarketer(marketerId),
    },
    select: { createdAt: true },
  });

  const dailyCounts = Array.from({ length: daysInMonth }, () => 0);
  let monthTotal = 0;

  for (const row of rows) {
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
