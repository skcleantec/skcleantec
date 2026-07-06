import type { PrismaClient } from '@prisma/client';

type SumRow = { external_company_id: string; sum_fee: bigint | number | null };

/**
 * 타업체 정산 목록 — 업체별 payable(발생−취소) 합계.
 * 전기간 inquiry findMany 2회 대신 SQL 집계 2회.
 */
export async function sumExternalSettlementSignedFeeByCompany(
  prisma: PrismaClient,
  tenantId: string,
  operatingCompanyId: string,
): Promise<Map<string, number>> {
  const signedByCompany = new Map<string, number>();

  const firstExtCte = `
    first_ext AS (
      SELECT DISTINCT ON (a.inquiry_id)
        a.inquiry_id,
        u.external_company_id
      FROM assignments a
      INNER JOIN users u ON u.id = a.team_leader_id
      INNER JOIN inquiries i ON i.id = a.inquiry_id
      WHERE i.tenant_id = $1::uuid
        AND i.operating_company_id = $2::uuid
        AND u.role = 'EXTERNAL_PARTNER'
        AND u.external_company_id IS NOT NULL
      ORDER BY a.inquiry_id, a.sort_order ASC
    )
  `;

  const activeRows = await prisma.$queryRawUnsafe<SumRow[]>(
    `
    WITH ${firstExtCte}
    SELECT fe.external_company_id, COALESCE(SUM(i.external_transfer_fee), 0)::bigint AS sum_fee
    FROM inquiries i
    INNER JOIN first_ext fe ON fe.inquiry_id = i.id
    WHERE i.tenant_id = $1::uuid
      AND i.operating_company_id = $2::uuid
      AND i.external_transfer_fee IS NOT NULL
      AND i.status NOT IN ('CANCELLED', 'ON_HOLD')
    GROUP BY fe.external_company_id
    `,
    tenantId,
    operatingCompanyId,
  );

  for (const r of activeRows) {
    if (!r.external_company_id) continue;
    signedByCompany.set(r.external_company_id, Number(r.sum_fee ?? 0));
  }

  const cancelledRows = await prisma.$queryRawUnsafe<SumRow[]>(
    `
    WITH ${firstExtCte}
    SELECT COALESCE(i.cancel_fee_external_company_id, fe.external_company_id) AS external_company_id,
           COALESCE(SUM(-i.external_transfer_fee), 0)::bigint AS sum_fee
    FROM inquiries i
    LEFT JOIN first_ext fe ON fe.inquiry_id = i.id
    WHERE i.tenant_id = $1::uuid
      AND i.operating_company_id = $2::uuid
      AND i.status = 'CANCELLED'
      AND i.external_transfer_fee IS NOT NULL
      AND (i.cancel_fee_external_company_id IS NOT NULL OR fe.external_company_id IS NOT NULL)
    GROUP BY COALESCE(i.cancel_fee_external_company_id, fe.external_company_id)
    `,
    tenantId,
    operatingCompanyId,
  );

  for (const r of cancelledRows) {
    if (!r.external_company_id) continue;
    signedByCompany.set(
      r.external_company_id,
      (signedByCompany.get(r.external_company_id) ?? 0) + Number(r.sum_fee ?? 0),
    );
  }

  return signedByCompany;
}
