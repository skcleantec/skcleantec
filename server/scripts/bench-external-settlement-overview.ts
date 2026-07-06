/**
 * 타업체 정산 목록 SQL 정밀 진단 — row count, EXPLAIN ANALYZE, wall time
 * Usage: cd server && npx tsx scripts/bench-external-settlement-overview.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.SKCT_TARGET_DATABASE_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - t0);
  console.log(`[TIME] ${label}: ${ms}ms`);
  return result;
}

async function main() {
  const tenants = await prisma.$queryRawUnsafe<
    Array<{ tenant_id: string; slug: string; fee_cnt: bigint }>
  >(
    `
    SELECT i.tenant_id, t.slug, COUNT(*)::bigint AS fee_cnt
    FROM inquiries i
    INNER JOIN tenants t ON t.id = i.tenant_id
    WHERE i.external_transfer_fee IS NOT NULL AND i.status <> 'ON_HOLD'
    GROUP BY i.tenant_id, t.slug
    ORDER BY fee_cnt DESC
    LIMIT 5
    `,
  );
  console.log('=== Top tenants by fee inquiries ===');
  for (const row of tenants) console.log(`  ${row.slug}: ${row.fee_cnt} fee inquiries`);

  const pick = tenants[0];
  if (!pick) {
    console.error('no fee inquiries in DB');
    process.exit(1);
  }

  const tenant = { id: pick.tenant_id, slug: pick.slug };
  const oc = await prisma.operatingCompany.findFirst({
    where: { tenantId: tenant.id, isDefault: true, isActive: true },
    select: { id: true, name: true },
  });
  if (!oc) {
    console.error('default operating company not found');
    process.exit(1);
  }

  console.log('tenant:', tenant.slug, tenant.id);
  console.log('operatingCompany:', oc.name, oc.id);

  const counts = await prisma.$queryRawUnsafe<
    Array<{ label: string; cnt: bigint }>
  >(
    `
    SELECT 'inquiries_all' AS label, COUNT(*)::bigint AS cnt FROM inquiries WHERE tenant_id = $1
    UNION ALL
    SELECT 'inquiries_fee', COUNT(*)::bigint FROM inquiries
      WHERE tenant_id = $1 AND operating_company_id = $2
        AND external_transfer_fee IS NOT NULL AND status <> 'ON_HOLD'
    UNION ALL
    SELECT 'assignments_tenant', COUNT(*)::bigint FROM assignments WHERE tenant_id = $1
    UNION ALL
    SELECT 'assignments_fee_join', COUNT(*)::bigint FROM assignments a
      INNER JOIN inquiries i ON i.id = a.inquiry_id
      WHERE a.tenant_id = $1 AND i.operating_company_id = $2
        AND i.external_transfer_fee IS NOT NULL AND i.status <> 'ON_HOLD'
    UNION ALL
    SELECT 'payments', COUNT(*)::bigint FROM external_company_settlement_payments p
      INNER JOIN external_companies ec ON ec.id = p.external_company_id
      WHERE ec.tenant_id = $1 AND p.operating_company_id = $2
    UNION ALL
    SELECT 'external_companies', COUNT(*)::bigint FROM external_companies
      WHERE tenant_id = $1 AND is_active = true
    `,
    tenant.id,
    oc.id,
  );
  console.log('\n=== Row counts ===');
  for (const r of counts) console.log(`  ${r.label}: ${r.cnt}`);

  const indexes = await prisma.$queryRawUnsafe<
    Array<{ indexname: string; tablename: string }>
  >(
    `
    SELECT indexname, tablename FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'inquiries_tenant_oc_external_fee_idx',
        'assignments_tenant_inquiry_sort_idx'
      )
    ORDER BY indexname
    `,
  );
  console.log('\n=== Migration indexes present ===');
  if (indexes.length === 0) console.log('  (NONE — migration may not be applied!)');
  for (const r of indexes) console.log(`  ${r.indexname} on ${r.tablename}`);

  const payableSql = `
    WITH fee_inquiries AS (
      SELECT id, external_transfer_fee, status, cancel_fee_external_company_id
      FROM inquiries
      WHERE tenant_id = $1
        AND operating_company_id = $2
        AND external_transfer_fee IS NOT NULL
        AND status <> 'ON_HOLD'
    ),
    first_ext AS (
      SELECT DISTINCT ON (a.inquiry_id)
        a.inquiry_id,
        u.external_company_id
      FROM assignments a
      INNER JOIN users u ON u.id = a.team_leader_id
        AND u.role = 'EXTERNAL_PARTNER'
        AND u.external_company_id IS NOT NULL
      INNER JOIN fee_inquiries fi ON fi.id = a.inquiry_id
      WHERE a.tenant_id = $1
      ORDER BY a.inquiry_id, a.sort_order ASC
    ),
    signed AS (
      SELECT fe.external_company_id AS external_company_id,
             SUM(fi.external_transfer_fee)::bigint AS sum_fee
      FROM fee_inquiries fi
      INNER JOIN first_ext fe ON fe.inquiry_id = fi.id
      WHERE fi.status <> 'CANCELLED'
      GROUP BY fe.external_company_id
      UNION ALL
      SELECT COALESCE(fi.cancel_fee_external_company_id, fe.external_company_id) AS external_company_id,
             SUM(-fi.external_transfer_fee)::bigint AS sum_fee
      FROM fee_inquiries fi
      LEFT JOIN first_ext fe ON fe.inquiry_id = fi.id
      WHERE fi.status = 'CANCELLED'
        AND (fi.cancel_fee_external_company_id IS NOT NULL OR fe.external_company_id IS NOT NULL)
      GROUP BY COALESCE(fi.cancel_fee_external_company_id, fe.external_company_id)
    )
    SELECT external_company_id, SUM(sum_fee)::bigint AS sum_fee
    FROM signed
    WHERE external_company_id IS NOT NULL
    GROUP BY external_company_id
  `;

  console.log('\n=== EXPLAIN ANALYZE (payable) ===');
  const explain = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${payableSql}`,
    tenant.id,
    oc.id,
  );
  for (const row of explain) console.log(row['QUERY PLAN']);

  await timed('payable full query (cold)', async () => {
    return prisma.$queryRawUnsafe(payableSql, tenant.id, oc.id);
  });
  await timed('payable full query (warm)', async () => {
    return prisma.$queryRawUnsafe(payableSql, tenant.id, oc.id);
  });

  const paidSql = `
    SELECT p.external_company_id, COALESCE(SUM(p.amount), 0)::bigint AS sum_paid
    FROM external_company_settlement_payments p
    INNER JOIN external_companies ec ON ec.id = p.external_company_id
    WHERE p.operating_company_id = $2
      AND ec.tenant_id = $1
    GROUP BY p.external_company_id
  `;

  console.log('\n=== EXPLAIN ANALYZE (paid/shell) ===');
  const explainPaid = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${paidSql}`,
    tenant.id,
    oc.id,
  );
  for (const row of explainPaid) console.log(row['QUERY PLAN']);

  await timed('paid query', async () => {
    return prisma.$queryRawUnsafe(paidSql, tenant.id, oc.id);
  });

  await timed('external companies findMany', async () => {
    return prisma.externalCompany.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });

  await timed('payable with ::uuid cast (production SQL)', async () => {
    try {
      return await prisma.$queryRawUnsafe(
        payableSql.replace(/\$1/g, '$1::uuid').replace(/\$2/g, '$2::uuid'),
        tenant.id,
        oc.id,
      );
    } catch (e) {
      console.log('[ERROR] uuid cast query failed:', (e as Error).message?.slice(0, 120));
      return [];
    }
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
