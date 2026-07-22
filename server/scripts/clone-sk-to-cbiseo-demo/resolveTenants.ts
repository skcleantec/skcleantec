import type { PrismaClient } from '@prisma/client';
import { EXCLUDED_OC_SLUGS, SOURCE_TENANT_SLUGS, TARGET_TENANT_SLUG } from './constants.js';

export async function resolveSourceTenant(prisma: PrismaClient) {
  for (const slug of SOURCE_TENANT_SLUGS) {
    const t = await prisma.tenant.findFirst({ where: { slug }, select: { id: true, slug: true, name: true } });
    if (t) return t;
  }
  throw new Error(`소스 SK 테넌트 없음 (slug: ${SOURCE_TENANT_SLUGS.join(', ')})`);
}

export async function resolveTargetTenant(prisma: PrismaClient) {
  const t = await prisma.tenant.findFirst({
    where: { slug: TARGET_TENANT_SLUG },
    select: { id: true, slug: true, name: true },
  });
  if (!t) throw new Error(`대상 cbiseo 테넌트 없음 (slug: ${TARGET_TENANT_SLUG})`);
  return t;
}

export function isExcludedOperatingCompany(slug: string, name: string): boolean {
  const s = slug.toLowerCase();
  if (EXCLUDED_OC_SLUGS.some((x) => s.includes(x))) return true;
  if (name.includes('타나클린')) return true;
  return false;
}

export async function resolveSourceOperatingCompanyIds(
  prisma: PrismaClient,
  sourceTenantId: string,
): Promise<string[]> {
  const rows = await prisma.operatingCompany.findMany({
    where: { tenantId: sourceTenantId, isActive: true },
    select: { id: true, slug: true, name: true },
  });
  return rows.filter((r) => !isExcludedOperatingCompany(r.slug, r.name)).map((r) => r.id);
}

export async function ensureTargetOperatingCompanies(
  prisma: PrismaClient,
  sourceTenantId: string,
  targetTenantId: string,
  dryRun: boolean,
): Promise<string> {
  const sourceRows = await prisma.operatingCompany.findMany({
    where: { tenantId: sourceTenantId },
    select: { id: true, slug: true, name: true, isDefault: true, isActive: true, sortOrder: true, config: true },
  });
  const included = sourceRows.filter((r) => !isExcludedOperatingCompany(r.slug, r.name));
  if (included.length === 0) throw new Error('복사할 SK 영업 브랜드(OperatingCompany)가 없습니다.');

  let defaultId = '';
  for (const src of included) {
    const existing = await prisma.operatingCompany.findFirst({
      where: { tenantId: targetTenantId, slug: src.slug },
      select: { id: true },
    });
    if (existing) {
      if (src.isDefault) defaultId = existing.id;
      continue;
    }
    if (dryRun) {
      if (src.isDefault) defaultId = src.id;
      continue;
    }
    const created = await prisma.operatingCompany.create({
      data: {
        tenantId: targetTenantId,
        slug: src.slug,
        name: src.name.includes('SK') ? '데모청소(SK)' : src.name,
        isDefault: src.isDefault,
        isActive: src.isActive,
        sortOrder: src.sortOrder,
        config: src.config ?? {},
      },
      select: { id: true },
    });
    if (src.isDefault) defaultId = created.id;
  }

  if (!defaultId) {
    const fallback = await prisma.operatingCompany.findFirst({
      where: { tenantId: targetTenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      select: { id: true },
    });
    if (!fallback) throw new Error('cbiseo 테넌트에 OperatingCompany가 없습니다.');
    defaultId = fallback.id;
  }
  return defaultId;
}

export function mapOperatingCompanyId(
  sourceOcId: string,
  sourceOcIds: string[],
  targetDefaultOcId: string,
): string {
  if (sourceOcIds.includes(sourceOcId)) return targetDefaultOcId;
  return targetDefaultOcId;
}
