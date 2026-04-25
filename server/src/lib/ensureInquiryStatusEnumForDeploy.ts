import type { PrismaClient } from '@prisma/client';

/**
 * Railway 등 프로덕션에서 `prisma migrate deploy` 없이 배포되면
 * Postgres `InquiryStatus` enum에 `ORDER_FORM_PENDING`이 없을 수 있다.
 * 그 상태로 행에 해당 값이 있으면(또는 쿼리·관계 로딩 시) Prisma가
 * `Value 'ORDER_FORM_PENDING' not found in enum 'InquiryStatus'` 로 프로세스를 죽인다.
 * idempotent DDL — 기동 직후 한 번 실행한다.
 */
export async function ensureInquiryStatusEnumForDeploy(prisma: PrismaClient): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('postgresql')) {
    return;
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'ORDER_FORM_PENDING'`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/already exists|duplicate/i.test(msg)) {
      return;
    }
    if (/IF NOT EXISTS|syntax error/i.test(msg)) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TYPE "InquiryStatus" ADD VALUE 'ORDER_FORM_PENDING'`);
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        if (/already exists|duplicate/i.test(msg2)) {
          return;
        }
        throw e2 instanceof Error ? e2 : new Error(String(e2));
      }
      return;
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}
