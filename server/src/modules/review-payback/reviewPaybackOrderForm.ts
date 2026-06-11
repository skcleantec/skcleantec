import type { PrismaClient } from '@prisma/client';
import { generateReviewPaybackToken } from './reviewPayback.token.js';
import { ensureReviewPaybackToken } from './reviewPayback.service.js';

/** 발주서 create data 에 spread — 발급 시 페이백 토큰 자동 부여 */
export function reviewPaybackTokenCreateField(): { reviewPaybackToken: string } {
  return { reviewPaybackToken: generateReviewPaybackToken() };
}

/** 레거시 발주서(토큰 없음) — 목록·메시지 복사 전 lazy 발급 */
export async function attachReviewPaybackTokensToOrderForms<
  T extends { id: string; tenantId: string; reviewPaybackToken?: string | null },
>(db: PrismaClient, rows: T[]): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (row.reviewPaybackToken) return row;
      const token = await ensureReviewPaybackToken(db, row.id, row.tenantId);
      return { ...row, reviewPaybackToken: token };
    }),
  );
}
