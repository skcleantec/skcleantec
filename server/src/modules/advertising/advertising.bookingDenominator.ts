import type { PrismaClient } from '@prisma/client';
import type { NormalizedAdSpendRow } from './advertising.sessionEndNormalize.js';

/** 직전 작업 종료 시각(없으면 이번 세션 시작) 초과 ~ endedAt 이하, 본인이 발급한 발주서 중 고객 제출 완료 건수 */
export async function countOrderFormSubmissionsInRange(
  prisma: PrismaClient,
  marketerUserId: string,
  rangeStartExclusive: Date,
  rangeEndInclusive: Date,
): Promise<number> {
  return prisma.orderForm.count({
    where: {
      createdById: marketerUserId,
      submittedAt: {
        gt: rangeStartExclusive,
        lte: rangeEndInclusive,
      },
    },
  });
}

/** 합산 제외 과목이 여러 개여도 평균 분모는 하나의 건수만 사용: 정렬상 첫 합산 제외 과목에만 count 부여 */
export function applyResolvedBookingDenominator(
  rows: NormalizedAdSpendRow[],
  resolved: number,
): void {
  const d = Math.max(0, Math.floor(Number(resolved)));
  for (const row of rows) {
    if (!row.countBreakdown?.length) continue;
    const sorted = [...row.countBreakdown].sort((a, b) =>
      a.lineItemId.localeCompare(b.lineItemId),
    );
    let applied = false;
    for (const cell of sorted) {
      const match = row.countBreakdown.find((x) => x.lineItemId === cell.lineItemId);
      if (!match || match.countsForSpend) continue;
      if (!applied) {
        match.count = d;
        applied = true;
      } else {
        match.count = 0;
      }
      match.lineAmountWon = 0;
      match.useAsAvgDenominator = true;
    }
  }
}
