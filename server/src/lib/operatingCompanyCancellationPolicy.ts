import type { PrismaClient } from '@prisma/client';
import {
  renderCancellationPolicyText,
  resolveOperatingCompanyCancellationPolicy,
} from './operatingCompanyCancellationPolicyCore.js';
import { parseOperatingCompanyConfig } from '../modules/operating-companies/operatingCompany.schema.js';
import {
  getDefaultOperatingCompanyId,
  getOperatingCompanyBySlug,
} from '../modules/operating-companies/operatingCompany.service.js';

type Db = PrismaClient;

export function cancellationPolicyTextFromConfig(configRaw: unknown): string {
  const config = parseOperatingCompanyConfig(configRaw);
  const policy = resolveOperatingCompanyCancellationPolicy(config.cancellationPolicy);
  return renderCancellationPolicyText(policy);
}

export async function loadCancellationPolicyTextForBrand(
  db: Db,
  tenantId: string,
  opts?: { operatingCompanyId?: string | null; brandSlug?: string | null },
): Promise<string> {
  const ocId = opts?.operatingCompanyId?.trim();
  const brandSlug = opts?.brandSlug?.trim().toLowerCase();
  try {
    if (brandSlug) {
      const oc = await getOperatingCompanyBySlug(db, tenantId, brandSlug);
      return cancellationPolicyTextFromConfig(oc.config);
    }
    if (ocId) {
      const row = await db.operatingCompany.findFirst({
        where: { id: ocId, tenantId },
        select: { config: true },
      });
      if (row) return cancellationPolicyTextFromConfig(row.config);
    }
    const defaultId = await getDefaultOperatingCompanyId(db, tenantId);
    const row = await db.operatingCompany.findFirst({
      where: { id: defaultId, tenantId },
      select: { config: true },
    });
    if (row) return cancellationPolicyTextFromConfig(row.config);
  } catch {
    /* fall through */
  }
  return renderCancellationPolicyText(resolveOperatingCompanyCancellationPolicy(undefined));
}
