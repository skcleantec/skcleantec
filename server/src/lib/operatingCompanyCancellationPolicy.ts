import type { PrismaClient } from '@prisma/client';
import {
  renderCancellationPolicyText,
  resolveOperatingCompanyCancellationPolicy,
  type OperatingCompanyCancellationPolicy,
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

function guideContextFromConfig(
  configRaw: unknown,
  opts?: { preferredDateYmd?: string | null },
): GuidePlaceholderContext {
  const config = parseOperatingCompanyConfig(configRaw);
  const policy = resolveOperatingCompanyCancellationPolicy(config.cancellationPolicy);
  return buildGuidePlaceholderContextFromPolicy(policy, opts);
}

export function guidePlaceholderContextFromConfig(
  configRaw: unknown,
  opts?: { preferredDateYmd?: string | null },
): GuidePlaceholderContext {
  return guideContextFromConfig(configRaw, opts);
}

export function cancellationPolicyTextFromConfig(configRaw: unknown): string {
  const config = parseOperatingCompanyConfig(configRaw);
  const policy = resolveOperatingCompanyCancellationPolicy(config.cancellationPolicy);
  return renderCancellationPolicyText(policy);
}

export async function loadCancellationPolicyForBrand(
  db: Db,
  tenantId: string,
  opts?: {
    operatingCompanyId?: string | null;
    brandSlug?: string | null;
  },
): Promise<OperatingCompanyCancellationPolicy> {
  const ocId = opts?.operatingCompanyId?.trim();
  const brandSlug = opts?.brandSlug?.trim().toLowerCase();
  try {
    if (brandSlug) {
      const oc = await getOperatingCompanyBySlug(db, tenantId, brandSlug);
      const config = parseOperatingCompanyConfig(oc.config);
      return resolveOperatingCompanyCancellationPolicy(config.cancellationPolicy);
    }
    if (ocId) {
      const row = await db.operatingCompany.findFirst({
        where: { id: ocId, tenantId },
        select: { config: true },
      });
      if (row) {
        const config = parseOperatingCompanyConfig(row.config);
        return resolveOperatingCompanyCancellationPolicy(config.cancellationPolicy);
      }
    }
    const defaultId = await getDefaultOperatingCompanyId(db, tenantId);
    const row = await db.operatingCompany.findFirst({
      where: { id: defaultId, tenantId },
      select: { config: true },
    });
    if (row) {
      const config = parseOperatingCompanyConfig(row.config);
      return resolveOperatingCompanyCancellationPolicy(config.cancellationPolicy);
    }
  } catch {
    /* fall through */
  }
  return resolveOperatingCompanyCancellationPolicy(undefined);
}

export async function loadCancellationGuideItemsForBrand(
  db: Db,
  tenantId: string,
  opts?: {
    operatingCompanyId?: string | null;
    brandSlug?: string | null;
  },
): Promise<string[] | undefined> {
  const ocId = opts?.operatingCompanyId?.trim();
  const brandSlug = opts?.brandSlug?.trim().toLowerCase();
  try {
    if (brandSlug) {
      const oc = await getOperatingCompanyBySlug(db, tenantId, brandSlug);
      return parseOperatingCompanyConfig(oc.config).cancellationGuideItems;
    }
    if (ocId) {
      const row = await db.operatingCompany.findFirst({
        where: { id: ocId, tenantId },
        select: { config: true },
      });
      if (row) return parseOperatingCompanyConfig(row.config).cancellationGuideItems;
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

export async function loadGuidePlaceholderContextForBrand(
  db: Db,
  tenantId: string,
  opts?: {
    operatingCompanyId?: string | null;
    brandSlug?: string | null;
    preferredDateYmd?: string | null;
  },
): Promise<GuidePlaceholderContext> {
  const ocId = opts?.operatingCompanyId?.trim();
  const brandSlug = opts?.brandSlug?.trim().toLowerCase();
  try {
    if (brandSlug) {
      const oc = await getOperatingCompanyBySlug(db, tenantId, brandSlug);
      return guideContextFromConfig(oc.config, { preferredDateYmd: opts?.preferredDateYmd });
    }
    if (ocId) {
      const row = await db.operatingCompany.findFirst({
        where: { id: ocId, tenantId },
        select: { config: true },
      });
      if (row) return guideContextFromConfig(row.config, { preferredDateYmd: opts?.preferredDateYmd });
    }
    const defaultId = await getDefaultOperatingCompanyId(db, tenantId);
    const row = await db.operatingCompany.findFirst({
      where: { id: defaultId, tenantId },
      select: { config: true },
    });
    if (row) return guideContextFromConfig(row.config, { preferredDateYmd: opts?.preferredDateYmd });
  } catch {
    /* fall through */
  }
  return buildGuidePlaceholderContextFromPolicy(
    resolveOperatingCompanyCancellationPolicy(undefined),
    { preferredDateYmd: opts?.preferredDateYmd },
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
