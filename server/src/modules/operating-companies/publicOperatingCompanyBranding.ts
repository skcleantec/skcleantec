import type { PrismaClient } from '@prisma/client';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import {
  getOperatingCompanyBySlug,
  operatingCompanySummary,
} from './operatingCompany.service.js';

export type PublicOperatingCompanyBrandingDto = {
  operatingCompanyId: string;
  slug: string;
  displayName: string;
  publicSubtitle: string | null;
};

function toPublicBrandingDto(
  oc: ReturnType<typeof operatingCompanySummary>,
  tenantFallback?: { displayName?: string; publicSubtitle?: string | null },
): PublicOperatingCompanyBrandingDto {
  const ocSubtitle = oc.config.orderForm?.publicSubtitle?.trim() || null;
  const fallbackSubtitle = tenantFallback?.publicSubtitle?.trim() || null;
  const ocDisplay = oc.displayName?.trim() || '';
  const fallbackDisplay = tenantFallback?.displayName?.trim() || '';
  return {
    operatingCompanyId: oc.id,
    slug: oc.slug,
    displayName: ocDisplay || fallbackDisplay || oc.name,
    publicSubtitle: ocSubtitle || fallbackSubtitle,
  };
}

export async function resolvePublicBrandingById(
  db: PrismaClient,
  tenantId: string,
  operatingCompanyId: string | null | undefined,
): Promise<PublicOperatingCompanyBrandingDto | null> {
  if (!operatingCompanyId?.trim()) return null;
  const row = await db.operatingCompany.findFirst({
    where: { id: operatingCompanyId.trim(), tenantId },
  });
  if (!row || !row.isActive) return null;
  const tenantConfig = await getTenantConfig(tenantId);
  return toPublicBrandingDto(operatingCompanySummary(row), {
    displayName: tenantConfig.branding?.displayName,
    publicSubtitle: tenantConfig.orderForm?.publicSubtitle ?? null,
  });
}

export async function resolvePublicBrandingBySlug(
  db: PrismaClient,
  tenantId: string,
  brandSlug: string | null | undefined,
): Promise<PublicOperatingCompanyBrandingDto | null> {
  if (!brandSlug?.trim()) return null;
  try {
    const oc = await getOperatingCompanyBySlug(db, tenantId, brandSlug);
    if (!oc.isActive) return null;
    const tenantConfig = await getTenantConfig(tenantId);
    return toPublicBrandingDto(oc, {
      displayName: tenantConfig.branding?.displayName,
      publicSubtitle: tenantConfig.orderForm?.publicSubtitle ?? null,
    });
  } catch {
    return null;
  }
}

/** 발주서·C/S 등 고객 화면 — 저장된 OC id 우선, 없으면 URL ?brand= */
export async function resolvePublicBrandingForCustomer(params: {
  db: PrismaClient;
  tenantId: string;
  operatingCompanyId?: string | null;
  brandSlug?: string | null;
}): Promise<PublicOperatingCompanyBrandingDto | null> {
  const fromId = await resolvePublicBrandingById(
    params.db,
    params.tenantId,
    params.operatingCompanyId,
  );
  if (fromId) return fromId;
  return resolvePublicBrandingBySlug(params.db, params.tenantId, params.brandSlug);
}

/** 테넌트 기본 표시명(브랜드 미지정 폴백) */
export async function resolveTenantPublicDisplayName(
  tenantId: string,
  tenantName: string,
): Promise<string> {
  const config = await getTenantConfig(tenantId);
  return config.branding?.displayName?.trim() || tenantName;
}
