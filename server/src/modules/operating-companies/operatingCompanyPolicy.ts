import type { Prisma, PrismaClient } from '@prisma/client';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';

export type OperatingCompanyAssignmentMode = 'strict' | 'relaxed';
export type OperatingCompanyTeamLeaderListMode = 'own_brands_only' | 'tenant_all_read';
export type OperatingCompanyInquiryDefaultMode =
  | 'user_primary'
  | 'from_intake_url'
  | 'creator_primary';

export type OperatingCompanyPolicy = {
  assignmentMode?: OperatingCompanyAssignmentMode;
  teamLeaderListMode?: OperatingCompanyTeamLeaderListMode;
  inquiryDefaultMode?: OperatingCompanyInquiryDefaultMode;
};

export const DEFAULT_OPERATING_COMPANY_POLICY: Required<OperatingCompanyPolicy> = {
  assignmentMode: 'relaxed',
  teamLeaderListMode: 'tenant_all_read',
  inquiryDefaultMode: 'user_primary',
};

type Db = PrismaClient | Prisma.TransactionClient;

function parsePolicyFromTenantConfig(raw: unknown): OperatingCompanyPolicy {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const p = o.operatingCompanyPolicy;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
  const po = p as Record<string, unknown>;
  const out: OperatingCompanyPolicy = {};
  if (po.assignmentMode === 'strict' || po.assignmentMode === 'relaxed') {
    out.assignmentMode = po.assignmentMode;
  }
  if (po.teamLeaderListMode === 'own_brands_only' || po.teamLeaderListMode === 'tenant_all_read') {
    out.teamLeaderListMode = po.teamLeaderListMode;
  }
  if (
    po.inquiryDefaultMode === 'user_primary' ||
    po.inquiryDefaultMode === 'from_intake_url' ||
    po.inquiryDefaultMode === 'creator_primary'
  ) {
    out.inquiryDefaultMode = po.inquiryDefaultMode;
  }
  return out;
}

export function resolveOperatingCompanyPolicy(raw: unknown): Required<OperatingCompanyPolicy> {
  const parsed = parsePolicyFromTenantConfig(raw);
  return {
    assignmentMode: parsed.assignmentMode ?? DEFAULT_OPERATING_COMPANY_POLICY.assignmentMode,
    teamLeaderListMode:
      parsed.teamLeaderListMode ?? DEFAULT_OPERATING_COMPANY_POLICY.teamLeaderListMode,
    inquiryDefaultMode:
      parsed.inquiryDefaultMode ?? DEFAULT_OPERATING_COMPANY_POLICY.inquiryDefaultMode,
  };
}

export async function getOperatingCompanyPolicy(
  db: Db,
  tenantId: string,
): Promise<Required<OperatingCompanyPolicy>> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  if (!tenant) return { ...DEFAULT_OPERATING_COMPANY_POLICY };
  return resolveOperatingCompanyPolicy(tenant.config);
}

export async function getOperatingCompanyPolicyFromService(
  tenantId: string,
): Promise<Required<OperatingCompanyPolicy>> {
  const config = await getTenantConfig(tenantId);
  return resolveOperatingCompanyPolicy({
    operatingCompanyPolicy: config.operatingCompanyPolicy,
  });
}
