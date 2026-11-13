import type { TenantPgOnboarding } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** 플랫폼 「카드결제 PG」 가맹점 진행 단계 */
export type PgMerchantStage =
  | 'NOT_APPLIED'
  | 'DRAFTING'
  | 'SUBMITTED'
  | 'FORWARDED'
  | 'CONTRACT_PENDING'
  | 'CONTRACT_DONE'
  | 'REJECTED';

export type PgMerchantStatusRow = {
  tenant: { id: string; name: string; slug: string };
  stage: PgMerchantStage;
  onboardingStatus: string | null;
  submittedAt: string | null;
  forwardedAt: string | null;
  decidedAt: string | null;
  contractSignedAt: string | null;
  contractMailedAt: string | null;
  keyConnected: boolean;
};

/** 업체가 화면을 열면 빈 작성중 기록이 자동으로 생긴다 — 직접 입력한 칸이 있어야 작성 중으로 본다 */
function hasUserInput(row: TenantPgOnboarding): boolean {
  return Boolean(
    row.contactName ||
      row.contactPhone ||
      row.contactEmail ||
      row.bankAccount ||
      row.accountHolder ||
      row.representativeBirth ||
      row.websiteUrl ||
      row.note ||
      row.businessCardImageUrl ||
      row.bankbookImageUrl ||
      row.idCardImageUrl ||
      row.sellerCenterLoginId ||
      row.consentTermsAt,
  );
}

export function resolvePgMerchantStage(row: TenantPgOnboarding | null): PgMerchantStage {
  if (!row) return 'NOT_APPLIED';
  switch (row.status) {
    case 'DRAFT':
      return hasUserInput(row) ? 'DRAFTING' : 'NOT_APPLIED';
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'FORWARDED_TO_PG':
      return 'FORWARDED';
    case 'REJECTED':
      return 'REJECTED';
    case 'APPROVED':
      return row.contractSignedAt ? 'CONTRACT_DONE' : 'CONTRACT_PENDING';
    default:
      return 'NOT_APPLIED';
  }
}

export async function listPgMerchantStatusForPlatform(): Promise<PgMerchantStatusRow[]> {
  const [tenants, onboardings, credentials] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.tenantPgOnboarding.findMany(),
    prisma.tenantPgCredential.findMany({ where: { isActive: true }, select: { tenantId: true } }),
  ]);
  const byTenant = new Map(onboardings.map((o) => [o.tenantId, o]));
  const keyed = new Set(credentials.map((c) => c.tenantId));
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

  return tenants
    .map((t) => {
      const row = byTenant.get(t.id) ?? null;
      const deleted = row?.merchantDeletedAt != null;
      return {
        tenant: t,
        stage: resolvePgMerchantStage(row),
        onboardingStatus: row?.status ?? null,
        submittedAt: iso(row?.submittedAt),
        forwardedAt: iso(row?.forwardedAt),
        decidedAt: iso(row?.decidedAt),
        contractSignedAt: iso(row?.contractSignedAt),
        contractMailedAt: iso(row?.contractMailedAt),
        keyConnected: !deleted && keyed.has(t.id),
      };
    })
    .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]);
}

/** 처리할 일이 있는 단계부터 위에 */
const STAGE_ORDER: Record<PgMerchantStage, number> = {
  SUBMITTED: 0,
  FORWARDED: 1,
  CONTRACT_PENDING: 2,
  DRAFTING: 3,
  CONTRACT_DONE: 4,
  NOT_APPLIED: 5,
  REJECTED: 6,
};
