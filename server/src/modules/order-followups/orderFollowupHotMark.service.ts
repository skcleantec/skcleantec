import type { OrderFollowupHotMark, Prisma, PrismaClient } from '@prisma/client';
import { addDaysToKstYmd, kstDayRangeYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { dateToYmdKst } from '../users/userEmployment.js';
import {
  collectFollowupPhoneDigits,
  followupPhonesOverlap,
  type FollowupWithRelations,
  FOLLOWUP_INCLUDE,
  serializeFollowup,
} from './orderFollowups.service.js';

export const HOT_MARK_REASONS = ['PRICE', 'DATE', 'FAMILY', 'COMPARE', 'CALL_LATER', 'OTHER'] as const;
export type HotMarkReason = (typeof HOT_MARK_REASONS)[number];

export const HOT_MARK_RESULTS = ['BOOKED', 'NO_ANSWER', 'THINKING', 'DROPPED'] as const;
export type HotMarkResult = (typeof HOT_MARK_RESULTS)[number];

export function parseHotMarkReason(raw: unknown): HotMarkReason | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase();
  return (HOT_MARK_REASONS as readonly string[]).includes(value) ? (value as HotMarkReason) : null;
}

export function parseHotMarkResult(raw: unknown): HotMarkResult | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase();
  return (HOT_MARK_RESULTS as readonly string[]).includes(value) ? (value as HotMarkResult) : null;
}

export function serializeMyHotMark(row: OrderFollowupHotMark | null | undefined) {
  if (!row || row.outcome) return null;
  return {
    reason: row.reason,
    memo: row.memo ?? null,
    nextContactAt: row.nextContactAt?.toISOString() ?? null,
    contactTries: row.contactTries,
  };
}

export function serializeFollowupWithHotMark(row: FollowupWithRelations, mark: OrderFollowupHotMark | null) {
  return { ...serializeFollowup(row), myHotMark: serializeMyHotMark(mark) };
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function loadOpenHotMarksForFollowups(
  db: Db,
  params: { tenantId: string; userId: string; followupIds: string[] },
): Promise<Map<string, OrderFollowupHotMark>> {
  if (params.followupIds.length === 0) return new Map();
  const rows = await db.orderFollowupHotMark.findMany({
    where: {
      tenantId: params.tenantId,
      userId: params.userId,
      outcome: null,
      followupId: { in: params.followupIds },
    },
  });
  return new Map(rows.map((row) => [row.followupId, row]));
}

function kstClock(date: Date): { hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return { hour: hour === '24' ? '00' : hour, minute };
}

/** 기준 시각의 시·분을 유지한 채 KST 하루 뒤 */
export function plusOneDaySameClock(from: Date): Date {
  const ymd = addDaysToKstYmd(dateToYmdKst(from), 1);
  const { hour, minute } = kstClock(from);
  return new Date(`${ymd}T${hour}:${minute}:00+09:00`);
}

/** 0 시각이 지난 것, 1 오늘 남은 것, 2 이후, 3 시각 없음 */
export function hotContactSortRank(at: Date | null, now = new Date()): number {
  if (!at) return 3;
  if (at.getTime() < now.getTime()) return 0;
  if (dateToYmdKst(at) === kstTodayYmd()) return 1;
  return 2;
}

export async function listHotFollowupPage(
  db: PrismaClient,
  params: {
    tenantId: string;
    userId: string;
    followupWhere: Prisma.OrderFollowupWhereInput;
    skip: number;
    take: number;
  },
) {
  const marks = await db.orderFollowupHotMark.findMany({
    where: {
      tenantId: params.tenantId,
      userId: params.userId,
      outcome: null,
      followup: params.followupWhere,
    },
    select: { followupId: true, nextContactAt: true, createdAt: true },
  });
  const now = new Date();
  marks.sort((a, b) => {
    const rank = hotContactSortRank(a.nextContactAt, now) - hotContactSortRank(b.nextContactAt, now);
    if (rank !== 0) return rank;
    const at = a.nextContactAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bt = b.nextContactAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (at !== bt) return at - bt;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const page = marks.slice(params.skip, params.skip + params.take);
  const rows = page.length
    ? await db.orderFollowup.findMany({
        where: { tenantId: params.tenantId, id: { in: page.map((mark) => mark.followupId) } },
        include: FOLLOWUP_INCLUDE,
      })
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    total: marks.length,
    rows: page.map((mark) => byId.get(mark.followupId)).filter((row): row is NonNullable<typeof row> => Boolean(row)),
  };
}

export async function hotMarkSummary(db: PrismaClient, params: { tenantId: string; userId: string }) {
  const todayRange = kstDayRangeYmd(kstTodayYmd());
  const openWhere = { tenantId: params.tenantId, userId: params.userId, outcome: null };
  const [today, overdue, open] = await Promise.all([
    todayRange
      ? db.orderFollowupHotMark.count({
          where: { ...openWhere, nextContactAt: { gte: todayRange.gte, lte: todayRange.lte } },
        })
      : Promise.resolve(0),
    db.orderFollowupHotMark.count({
      where: { ...openWhere, nextContactAt: { lt: new Date() } },
    }),
    db.orderFollowupHotMark.count({ where: openWhere }),
  ]);
  return { today, overdue, open };
}

/** 같은 전화번호 접수가 생기면 그 고객의 진행 중 가망 표시를 예약됨으로 닫는다. */
export async function bookOpenHotMarksForCustomerPhones(
  db: Db,
  params: { tenantId: string; customerPhone: string; customerPhone2?: string | null },
): Promise<number> {
  const digits = collectFollowupPhoneDigits(params.customerPhone, params.customerPhone2);
  if (digits.length === 0) return 0;
  const tails = [...new Set(digits.map((digit) => digit.slice(-4)))];
  const candidates = await db.orderFollowup.findMany({
    where: {
      tenantId: params.tenantId,
      OR: tails.flatMap((tail) => [
        { customerPhone: { contains: tail } },
        { customerPhone2: { contains: tail } },
      ]),
    },
    select: { id: true, customerPhone: true, customerPhone2: true },
  });
  const followupIds = candidates
    .filter((row) =>
      followupPhonesOverlap(row.customerPhone, row.customerPhone2, params.customerPhone, params.customerPhone2),
    )
    .map((row) => row.id);
  if (followupIds.length === 0) return 0;
  const updated = await db.orderFollowupHotMark.updateMany({
    where: { tenantId: params.tenantId, followupId: { in: followupIds }, outcome: null },
    data: { outcome: 'BOOKED', closedAt: new Date() },
  });
  return updated.count;
}
