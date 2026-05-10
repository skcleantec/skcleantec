import type { PrismaClient } from '@prisma/client';
import type { NormalizedAdSpendRow } from './advertising.sessionEndNormalize.js';
/**
 * 세션 구간 내 마케터 발주서 실적 자동 분모.
 * - 고객 제출 완료: submittedAt 이 구간 안 (기존과 동일)
 * - 미제출 신규 발급: 본인 발급·아직 미제출이며 createdAt 이 구간 안 (링크만 낸 건 반영)
 */
export async function countBookingDenominatorAuto(
  prisma: PrismaClient,
  marketerUserId: string,
  rangeStartExclusive: Date,
  rangeEndInclusive: Date,
): Promise<number> {
  const [submittedInRange, pendingIssuedInRange] = await Promise.all([
    prisma.orderForm.count({
      where: {
        createdById: marketerUserId,
        submittedAt: {
          gt: rangeStartExclusive,
          lte: rangeEndInclusive,
        },
      },
    }),
    prisma.orderForm.count({
      where: {
        createdById: marketerUserId,
        submittedAt: null,
        createdAt: {
          gt: rangeStartExclusive,
          lte: rangeEndInclusive,
        },
      },
    }),
  ]);
  return submittedInRange + pendingIssuedInRange;
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

/**
 * 광고 분석 「예약완료 건수」.
 * 조회 기간 안에 `endedAt`이 들어간 작업 세션마다:
 * - `bookingDenominatorCount`가 있으면 종료 시 확정값(수동 우선·아니면 당시 자동 집계) 사용
 * - 없으면 직전 종료 시각(없으면 세션 시작)~이번 종료 시각 구간으로 `countBookingDenominatorAuto` 재계산
 *
 * 사용자별 세션 타임라인을 맞추기 위해 `endedAt <= rangeTo` 인 종료 세션을 사용자·시간순으로 한 번 스캔한다.
 */
export async function sumReservationCountsFromWorkSessionsInPeriod(
  prisma: PrismaClient,
  rangeFrom: Date,
  rangeTo: Date,
  marketerIds: string[] | 'ALL_MARKETERS',
): Promise<{ total: number; byUser: Map<string, number> }> {
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
      bookingDenominatorCount: true,
    },
    orderBy: [{ userId: 'asc' }, { endedAt: 'asc' }],
  });

  type Pending = {
    userId: string;
    stored: number | null;
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
        stored: row.bookingDenominatorCount,
        rangeStartExclusive,
        endedAt,
      });
    }

    prevEndedAt = endedAt;
  }

  const resolved = await Promise.all(
    pending.map((p) =>
      p.stored != null
        ? Promise.resolve(p.stored)
        : countBookingDenominatorAuto(prisma, p.userId, p.rangeStartExclusive, p.endedAt),
    ),
  );

  const byUser = new Map<string, number>();
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i]!;
    const c = resolved[i]!;
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + c);
  }

  let total = 0;
  for (const v of byUser.values()) total += v;
  return { total, byUser };
}
