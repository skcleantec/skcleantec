import type { PrismaClient } from '@prisma/client';

type SumRow = { external_company_id: string; sum_fee: bigint | number | null };

/**
 * 타업체 정산 목록 — 업체별 payable(발생−취소) 합계.
 * fee 있는 inquiry만 CTE → assignment DISTINCT ON 범위 축소, active/cancel 1쿼리.
 * EXTERNAL_LEGACY 파트너 연계(타업체 승격 이관) 건은 assignment 없이 share로 귀속.
 */
export async function sumExternalSettlementSignedFeeByCompany(
  prisma: PrismaClient,
  tenantId: string,
  operatingCompanyId: string,
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRawUnsafe<SumRow[]>(
    `
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
    hybrid_ext AS (
      SELECT
        s.source_inquiry_id AS inquiry_id,
        s.settlement_external_company_id AS external_company_id
      FROM tenant_inquiry_shares s
      INNER JOIN fee_inquiries fi ON fi.id = s.source_inquiry_id
      WHERE s.source_tenant_id = $1
        AND s.sync_status = 'ACTIVE'
        AND s.settlement_mode = 'EXTERNAL_LEGACY'
        AND s.settlement_external_company_id IS NOT NULL
    ),
    marketplace_ext AS (
      SELECT DISTINCT
        l.inquiry_id,
        l.buyer_external_company_id AS external_company_id
      FROM inquiry_db_listings l
      INNER JOIN fee_inquiries fi ON fi.id = l.inquiry_id
      WHERE l.tenant_id = $1
        AND l.status = 'CONFIRMED'
        AND l.buyer_kind = 'EXTERNAL_COMPANY'
        AND l.buyer_external_company_id IS NOT NULL
    ),
    inquiry_company AS (
      SELECT me.inquiry_id, me.external_company_id
      FROM marketplace_ext me
      UNION ALL
      SELECT fe.inquiry_id, fe.external_company_id
      FROM first_ext fe
      WHERE NOT EXISTS (SELECT 1 FROM marketplace_ext me WHERE me.inquiry_id = fe.inquiry_id)
      UNION ALL
      SELECT h.inquiry_id, h.external_company_id
      FROM hybrid_ext h
      WHERE NOT EXISTS (SELECT 1 FROM marketplace_ext me WHERE me.inquiry_id = h.inquiry_id)
    ),
    signed AS (
      SELECT ic.external_company_id AS external_company_id,
             SUM(fi.external_transfer_fee)::bigint AS sum_fee
      FROM fee_inquiries fi
      INNER JOIN inquiry_company ic ON ic.inquiry_id = fi.id
      WHERE fi.status <> 'CANCELLED'
      GROUP BY ic.external_company_id

      UNION ALL

      SELECT COALESCE(fi.cancel_fee_external_company_id, ic.external_company_id) AS external_company_id,
             SUM(-fi.external_transfer_fee)::bigint AS sum_fee
      FROM fee_inquiries fi
      LEFT JOIN inquiry_company ic ON ic.inquiry_id = fi.id
      WHERE fi.status = 'CANCELLED'
        AND (fi.cancel_fee_external_company_id IS NOT NULL OR ic.external_company_id IS NOT NULL)
      GROUP BY COALESCE(fi.cancel_fee_external_company_id, ic.external_company_id)
    )
    SELECT external_company_id, SUM(sum_fee)::bigint AS sum_fee
    FROM signed
    WHERE external_company_id IS NOT NULL
    GROUP BY external_company_id
    `,
    tenantId,
    operatingCompanyId,
  );

  const signedByCompany = new Map<string, number>();
  for (const r of rows) {
    if (!r.external_company_id) continue;
    signedByCompany.set(r.external_company_id, Number(r.sum_fee ?? 0));
  }
  return signedByCompany;
}

/** 지급 합계 — groupBy 대신 SQL 1회(동일 라운드트립 묶음용) */
export async function sumExternalSettlementPaidByCompany(
  prisma: PrismaClient,
  tenantId: string,
  operatingCompanyId: string,
): Promise<Map<string, number>> {
  type PaidRow = { external_company_id: string; sum_paid: bigint | number | null };
  const rows = await prisma.$queryRawUnsafe<PaidRow[]>(
    `
    SELECT p.external_company_id, COALESCE(SUM(p.amount), 0)::bigint AS sum_paid
    FROM external_company_settlement_payments p
    INNER JOIN external_companies ec ON ec.id = p.external_company_id
    WHERE p.operating_company_id = $2
      AND ec.tenant_id = $1
    GROUP BY p.external_company_id
    `,
    tenantId,
    operatingCompanyId,
  );
  const paidByCompany = new Map<string, number>();
  for (const r of rows) {
    paidByCompany.set(r.external_company_id, Number(r.sum_paid ?? 0));
  }
  return paidByCompany;
}
