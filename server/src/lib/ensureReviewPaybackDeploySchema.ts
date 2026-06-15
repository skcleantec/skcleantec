import type { PrismaClient } from '@prisma/client';

/**
 * `review_payback_requests.review_images` 는 phase1 테이블 생성(20260615120000) 이후
 * 별도 마이그레이션(20260611160000, 타임스탬프가 더 이른 파일)으로 추가된다.
 * phase1만 적용된 DB에서는 Prisma create 시 500(P2022)이 난다.
 * idempotent DDL — 기동 직후 한 번 실행한다.
 */
export async function ensureReviewPaybackDeploySchema(prisma: PrismaClient): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('postgresql')) {
    return;
  }

  const table = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'review_payback_requests'
  `;
  if (table.length === 0) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "review_payback_requests"
    ADD COLUMN IF NOT EXISTS "review_images" JSONB NOT NULL DEFAULT '[]'
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "review_payback_requests"
    SET "review_images" = jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'url', "review_image_url",
          'publicId', "review_image_public_id"
        )
      )
    )
    WHERE ("review_images" IS NULL OR "review_images" = '[]'::jsonb)
      AND "review_image_url" IS NOT NULL
      AND TRIM("review_image_url") <> ''
  `);
}
