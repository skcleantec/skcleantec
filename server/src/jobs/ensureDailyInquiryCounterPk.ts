import { prisma } from '../lib/prisma.js';

/**
 * daily_inquiry_counters PK가 (tenant_id, date_key) 구형이면
 * (tenant_id, operating_company_id, date_key)로 idempotent 보정.
 * 운영 DB → 스테이징 복원 후 migrate 기록은 있으나 실제 PK가 안 바뀐 드리프트 대응.
 */
export async function ensureDailyInquiryCounterPk(): Promise<void> {
  const rows = await prisma.$queryRaw<{ has_oc_pk: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
      WHERE t.relname = 'daily_inquiry_counters'
        AND c.contype = 'p'
        AND a.attname = 'operating_company_id'
    ) AS has_oc_pk
  `;
  if (rows[0]?.has_oc_pk) return;

  await prisma.$executeRaw`
    ALTER TABLE "daily_inquiry_counters" ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT
  `;

  await prisma.$executeRaw`
    UPDATE "daily_inquiry_counters" dic
    SET "operating_company_id" = oc."id"
    FROM "operating_companies" oc
    WHERE oc."tenant_id" = dic."tenant_id"
      AND oc."is_default" = true
      AND dic."operating_company_id" IS NULL
  `;

  await prisma.$executeRaw`
    UPDATE "daily_inquiry_counters" dic
    SET "operating_company_id" = sub."id"
    FROM (
      SELECT DISTINCT ON (oc."tenant_id") oc."tenant_id", oc."id"
      FROM "operating_companies" oc
      WHERE oc."is_active" = true
      ORDER BY oc."tenant_id", oc."sort_order" ASC, oc."created_at" ASC
    ) sub
    WHERE dic."tenant_id" = sub."tenant_id"
      AND dic."operating_company_id" IS NULL
  `;

  await prisma.$executeRaw`
    DELETE FROM "daily_inquiry_counters" WHERE "operating_company_id" IS NULL
  `;

  await prisma.$executeRaw`
    ALTER TABLE "daily_inquiry_counters" DROP CONSTRAINT IF EXISTS "daily_inquiry_counters_pkey"
  `;

  await prisma.$executeRaw`
    ALTER TABLE "daily_inquiry_counters" ADD CONSTRAINT "daily_inquiry_counters_pkey"
      PRIMARY KEY ("tenant_id", "operating_company_id", "date_key")
  `;

  const fkExists = await prisma.$queryRaw<{ one: number }[]>`
    SELECT 1 AS one FROM pg_constraint WHERE conname = 'daily_inquiry_counters_operating_company_id_fkey'
  `;
  if (fkExists.length === 0) {
    await prisma.$executeRaw`
      ALTER TABLE "daily_inquiry_counters"
        ADD CONSTRAINT "daily_inquiry_counters_operating_company_id_fkey"
        FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `;
  }

  await prisma.$executeRaw`
    ALTER TABLE "daily_inquiry_counters" ALTER COLUMN "operating_company_id" SET NOT NULL
  `;
}
