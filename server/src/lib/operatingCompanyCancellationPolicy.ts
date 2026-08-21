import type { PrismaClient } from '@prisma/client';
import {
  renderCancellationPolicyText,
  resolveOperatingCompanyCancellationPolicy,
} from './operatingCompanyCancellationPolicyCore.js';
import {
  buildGuidePlaceholderContextFromPolicy,
  type GuidePlaceholderContext,
} from './orderFormGuidePlaceholders.js';
import { parseOperatingCompanyConfig } from '../modules/operating-companies/operatingCompany.schema.js';
import {
  getDefaultOperatingCompanyId,
  getOperatingCompanyBySlug,
} from '../modules/operating-companies/operatingCompany.service.js';

type Db = PrismaClient;

export function guidePlaceholderContextFromConfig(configRaw: unknown): GuidePlaceholderContext {
  const config = parseOperatingCompanyConfig(configRaw);
  const policy = resolveOperatingCompanyCancellationPolicy(config.cancellationPolicy);
  return buildGuidePlaceholderContextFromPolicy(policy);
}

export function cancellationPolicyTextFromConfig(configRaw: unknown): string {
  const config = parseOperatingCompanyConfig(configRaw);
  const policy = resolveOperatingCompanyCancellationPolicy(config.cancellationPolicy);
  return renderCancellationPolicyText(policy);
}

export async function loadGuidePlaceholderContextForBrand(
  db: Db,
  tenantId: string,
  opts?: { operatingCompanyId?: string | null; brandSlug?: string | null },
): Promise<GuidePlaceholderContext> {
  const ocId = opts?.operatingCompanyId?.trim();
  const brandSlug = opts?.brandSlug?.trim().toLowerCase();
  try {
    if (brandSlug) {
      const oc = await getOperatingCompanyBySlug(db, tenantId, brandSlug);
      return guidePlaceholderContextFromConfig(oc.config);
    }
    if (ocId) {
      const row = await db.operatingCompany.findFirst({
        where: { id: ocId, tenantId },
        select: { config: true },
      });
      if (row) return guidePlaceholderContextFromConfig(row.config);
    }
    const defaultId = await getDefaultOperatingCompanyId(db, tenantId);
    const row = await db.operatingCompany.findFirst({
      where: { id: defaultId, tenantId },
      select: { config: true },
    });
    if (row) return guidePlaceholderContextFromConfig(row.config);
  } catch {
    /* fall through */
  }
  return buildGuidePlaceholderContextFromPolicy(
    resolveOperatingCompanyCancellationPolicy(undefined),
  );
}

/** @deprecated loadGuidePlaceholderContextForBrand 사용 */
export async function loadCancellationPolicyTextForBrand(
  db: Db,
  tenantId: string,
  opts?: { operatingCompanyId?: string | null; brandSlug?: string | null },
): Promise<string> {
  const ctx = await loadGuidePlaceholderContextForBrand(db, tenantId, opts);
  return ctx.cancellationPolicyText ?? '';
}
