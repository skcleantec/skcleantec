import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import {
  mergeTenantConfig,
  parseTenantConfig,
  tenantConfigToJson,
  type TenantConfig,
} from './tenantConfig.schema.js';
import { TenantNotFoundError } from './tenant.service.js';
import {
  operatingCompanyConfigToJson,
  parseOperatingCompanyConfig,
  type OperatingCompanyConfig,
} from '../operating-companies/operatingCompany.schema.js';

function l1PatchSectionKeys(patchRaw: unknown): Set<string> {
  if (!patchRaw || typeof patchRaw !== 'object' || Array.isArray(patchRaw)) return new Set();
  return new Set(Object.keys(patchRaw as Record<string, unknown>));
}

/** L1 Tenant.config 변경 시 기본 영업 브랜드(OperatingCompany)에 동일 문구 반영 — 고객 발주서·public-info가 OC를 읽음 */
async function syncTenantL1ToDefaultOperatingCompany(
  tenantId: string,
  merged: TenantConfig,
  touched: Set<string>,
): Promise<void> {
  const shouldSync = ['branding', 'orderForm', 'inquiry'].some((k) => touched.has(k));
  if (!shouldSync) return;

  const oc = await prisma.operatingCompany.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true, config: true },
  });
  if (!oc) return;

  const existing = parseOperatingCompanyConfig(oc.config);
  const next: OperatingCompanyConfig = {
    ...existing,
  };

  if (touched.has('branding')) {
    const branding: NonNullable<OperatingCompanyConfig['branding']> = {};
    const displayName = merged.branding?.displayName?.trim();
    const loginSubtitle = merged.branding?.loginSubtitle?.trim();
    if (displayName) branding.displayName = displayName;
    if (loginSubtitle) branding.loginSubtitle = loginSubtitle;
    if (existing.branding?.badgeColorKey) branding.badgeColorKey = existing.branding.badgeColorKey;
    next.branding = Object.keys(branding).length > 0 ? branding : undefined;
  }

  if (touched.has('orderForm')) {
    const subtitle = merged.orderForm?.publicSubtitle?.trim();
    next.orderForm = subtitle ? { publicSubtitle: subtitle } : undefined;
  }

  if (touched.has('inquiry')) {
    const prefix = merged.inquiry?.numberPrefix?.trim();
    next.inquiry = prefix ? { numberPrefix: prefix } : undefined;
  }

  await prisma.operatingCompany.update({
    where: { id: oc.id },
    data: { config: operatingCompanyConfigToJson(next) as Prisma.InputJsonValue },
  });
}

export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  if (!row) throw new TenantNotFoundError();
  return parseTenantConfig(row.config);
}

export async function updateTenantConfig(tenantId: string, patchRaw: unknown): Promise<TenantConfig> {
  const existing = await getTenantConfig(tenantId);
  const patch = parseTenantConfig(patchRaw);
  const merged = mergeTenantConfig(existing, patch);
  const json = tenantConfigToJson(merged);
  const touched = l1PatchSectionKeys(patchRaw);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { config: json as Prisma.InputJsonValue },
  });

  await syncTenantL1ToDefaultOperatingCompany(tenantId, merged, touched);

  return merged;
}

export async function replaceTenantConfig(tenantId: string, configRaw: unknown): Promise<TenantConfig> {
  const parsed = parseTenantConfig(configRaw);
  const json = tenantConfigToJson(parsed);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { config: json as Prisma.InputJsonValue },
  });
  await syncTenantL1ToDefaultOperatingCompany(
    tenantId,
    parsed,
    new Set(['branding', 'orderForm', 'inquiry']),
  );
  return parsed;
}
