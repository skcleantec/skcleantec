import type { InquiryStatus, PrismaClient } from '@prisma/client';
import type { NormalizedAdSpendRow } from './advertising.sessionEndNormalize.js';

export type BookingDenominatorBreakdown = {
  /** 취소·삭제 제외 — ROAS·건당 비용 분모 */
  activeCount: number;
  /** 구간 내 발주서 중 접수가 취소된 건 */
  cancelledCount: number;
  /** 구간 내 삭제(발주서 삭제·접수만 삭제된 고아 발주서) */
  deletedCount: number;
};

type DenominatorClass = 'active' | 'cancelled' | 'deleted';

function classifyOrderFormForDenominator(row: {
  submittedAt: Date | null;
  inquiries: { status: InquiryStatus }[];
}): DenominatorClass {
  if (row.inquiries.length > 0) {
    return row.inquiries[0]!.status === 'CANCELLED' ? 'cancelled' : 'active';
  }
  /** 고객 제출 후 접수만 삭제된 발주서 — 분모에서 제외 */
  if (row.submittedAt != null) return 'deleted';
  /** 미제출 발급(링크만) — 접수 행 없어도 유효 */
  return 'active';
}

/**
 * 세션 구간 내 마케터 발주서 실적 자동 분모.
 * - 고객 제출 완료: submittedAt 이 구간 안
 * - 미제출 신규 발급: 본인 발급·아직 미제출이며 createdAt 이 구간 안 (링크만 낸 건 반영)
 * - 연결 접수 CANCELLED → cancelledCount
 * - 제출 후 접수만 삭제(고아 발주서) · 발주서 영구 삭제 로그 → deletedCount
 */
export async function countBookingDenominatorAuto(
  prisma: PrismaClient,
  marketerUserId: string,
  rangeStartExclusive: Date,
  rangeEndInclusive: Date,
): Promise<BookingDenominatorBreakdown> {
  const orderFormSelect = {
    submittedAt: true,
    inquiries: {
      select: { status: true },
      orderBy: { createdAt: 'desc' as const },
      take: 1,
    },
  };

  const [submittedInRange, pendingIssuedInRange, deletedLogCount] = await Promise.all([
    prisma.orderForm.findMany({
      where: {
        createdById: marketerUserId,
        submittedAt: {
          gt: rangeStartExclusive,
          lte: rangeEndInclusive,
        },
      },
      select: orderFormSelect,
    }),
    prisma.orderForm.findMany({
      where: {
        createdById: marketerUserId,
        submittedAt: null,
        createdAt: {
          gt: rangeStartExclusive,
          lte: rangeEndInclusive,
        },
      },
      select: orderFormSelect,
    }),
    prisma.orderFormDeleteLog.count({
      where: {
        createdById: marketerUserId,
        OR: [
          {
            submittedAt: {
              gt: rangeStartExclusive,
              lte: rangeEndInclusive,
            },
          },
          {
            submittedAt: null,
            orderFormCreatedAt: {
              gt: rangeStartExclusive,
              lte: rangeEndInclusive,
            },
          },
        ],
      },
    }),
  ]);

  let activeCount = 0;
  let cancelledCount = 0;
  let deletedCount = deletedLogCount;
  for (const row of [...submittedInRange, ...pendingIssuedInRange]) {
    const cls = classifyOrderFormForDenominator(row);
    if (cls === 'cancelled') cancelledCount += 1;
    else if (cls === 'deleted') deletedCount += 1;
    else activeCount += 1;
  }

  return { activeCount, cancelledCount, deletedCount };
}

/**
 * 합산 제외 과목이 여러 개여도 평균 분모는 하나의 건수만 사용.
 * - 라벨에 「예약확정」이 있으면 그 과목(숨고 등 표준 명칭)
 * - 없으면 채널 설정 순서상 첫 합산 제외 과목 (UUID 정렬 금지 — 예약확정에 안 들어가던 버그 방지)
 */
export function applyResolvedBookingDenominator(
  rows: NormalizedAdSpendRow[],
  resolved: number,
): void {
  const d = Math.max(0, Math.floor(Number(resolved)));
  for (const row of rows) {
    if (!row.countBreakdown?.length) continue;
    const denomCells = row.countBreakdown.filter((c) => !c.countsForSpend);
    if (denomCells.length === 0) continue;

    const compactLabel = (s: string) => s.replace(/\s+/g, '');
    const preferred = denomCells.find((c) => compactLabel(c.label).includes('예약확정'));
    const chosenId = preferred?.lineItemId ?? denomCells[0]!.lineItemId;

    for (const cell of row.countBreakdown) {
      if (cell.countsForSpend) continue;
      cell.count = cell.lineItemId === chosenId ? d : 0;
      cell.lineAmountWon = 0;
      cell.useAsAvgDenominator = true;
    }
  }
}

export type ReservationCountPeriodAgg = {
  total: number;
  cancelledTotal: number;
  deletedTotal: number;
  byUser: Map<string, number>;
  cancelledByUser: Map<string, number>;
  deletedByUser: Map<string, number>;
};

/**
 * 광고 분석 「예약완료 건수」.
 * 조회 기간 안에 `endedAt`이 들어간 작업 세션마다 직전 종료~이번 종료 구간을
 * `countBookingDenominatorAuto`로 재계산한다(취소·삭제 반영·현재 상태 기준).
 *
 * 사용자별 세션 타임라인을 맞추기 위해 `endedAt <= rangeTo` 인 종료 세션을 사용자·시간순으로 한 번 스캔한다.
 */
export async function sumReservationCountsFromWorkSessionsInPeriod(
  prisma: PrismaClient,
  rangeFrom: Date,
  rangeTo: Date,
  marketerIds: string[] | 'ALL_MARKETERS',
): Promise<ReservationCountPeriodAgg> {
  const userWhere = marketerIds === 'ALL_MARKETERS' ? {} : { userId: { in: marketerIds } };

  const chain = await prisma.adWorkSession.findMany({
    where: {
      endedAt: { not: null, lte: rangeTo },
      ...userWhere,
    },
    select: {
      userId: true,
      startedAt: true,
      endedAt: true,
    },
    orderBy: [{ userId: 'asc' }, { endedAt: 'asc' }],
  });

  type Pending = {
    userId: string;
    rangeStartExclusive: Date;
    endedAt: Date;
  };
  const pending: Pending[] = [];

  let prevUserId: string | null = null;
  let prevEndedAt: Date | null = null;

  for (const row of chain) {
    const uid = row.userId;
    const endedAt = row.endedAt!;
    if (uid !== prevUserId) {
      prevUserId = uid;
      prevEndedAt = null;
    }
    const rangeStartExclusive = prevEndedAt ?? row.startedAt;

    if (endedAt >= rangeFrom && endedAt <= rangeTo) {
      pending.push({
        userId: uid,
        rangeStartExclusive,
        endedAt,
      });
    }

    prevEndedAt = endedAt;
  }

  const resolved = await Promise.all(
    pending.map((p) => countBookingDenominatorAuto(prisma, p.userId, p.rangeStartExclusive, p.endedAt)),
  );

  const byUser = new Map<string, number>();
  const cancelledByUser = new Map<string, number>();
  const deletedByUser = new Map<string, number>();
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i]!;
    const b = resolved[i]!;
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + b.activeCount);
    cancelledByUser.set(p.userId, (cancelledByUser.get(p.userId) ?? 0) + b.cancelledCount);
    deletedByUser.set(p.userId, (deletedByUser.get(p.userId) ?? 0) + b.deletedCount);
  }

  let total = 0;
  let cancelledTotal = 0;
  let deletedTotal = 0;
  for (const v of byUser.values()) total += v;
  for (const v of cancelledByUser.values()) cancelledTotal += v;
  for (const v of deletedByUser.values()) deletedTotal += v;
  return { total, cancelledTotal, deletedTotal, byUser, cancelledByUser, deletedByUser };
}
