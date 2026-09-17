import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import {
  getDefaultOperatingCompanyId,
  OperatingCompanyNotFoundError,
} from '../operating-companies/operatingCompany.service.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { DEFAULT_TENANT_ID } from '../tenants/tenant.constants.js';
import { readRequestHost, resolveTenantSlugFromHost } from '../tenants/tenantHostResolve.js';
import { resolveTenantBySlug, TenantNotFoundError } from '../tenants/tenant.service.js';
import { DEFAULT_LANDING_CONTACT_CUSTOM_FIELDS } from './landingContactForm.schema.js';

type Db = PrismaClient;

export async function assertLandingContactFeatureEnabled(tenantId: string): Promise<boolean> {
  return isFeatureEnabled(tenantId, 'mod_landing_inquiry');
}

/** `tana` → `tanaclean` 처럼 짧은 브랜드 코드도 연결 */
export async function findOperatingCompanyIdForLandingBrand(
  tenantId: string,
  brandSlug: string,
  db: Db = prisma,
): Promise<string | null> {
  const slug = brandSlug.trim().toLowerCase();
  if (!slug) return null;
  const exact = await db.operatingCompany.findFirst({
    where: { tenantId, slug, isActive: true },
    select: { id: true },
  });
  if (exact) return exact.id;

  const prefixed = await db.operatingCompany.findMany({
    where: { tenantId, isActive: true, slug: { startsWith: slug } },
    select: { id: true, slug: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  if (prefixed.length === 0) return null;
  const preferred = prefixed.find((row) => row.slug === `${slug}clean`) ?? prefixed[0];
  return preferred.id;
}

export async function resolveLandingContactOperatingCompanyId(
  tenantId: string,
  brandSlug: string | null | undefined,
  db: Db = prisma,
): Promise<string> {
  const slug = brandSlug?.trim().toLowerCase();
  if (slug) {
    const found = await findOperatingCompanyIdForLandingBrand(tenantId, slug, db);
    if (found) return found;
    throw new OperatingCompanyNotFoundError('해당 브랜드 문의 폼을 찾을 수 없습니다.');
  }
  return getDefaultOperatingCompanyId(db, tenantId);
}

function readRequestedTenantSlug(req: Request): string {
  const body = req.body as { tenantSlug?: unknown };
  const bodySlug = typeof body?.tenantSlug === 'string' ? body.tenantSlug.trim() : '';
  const queryTenant = typeof req.query?.tenant === 'string' ? req.query.tenant.trim() : '';
  const querySlug = typeof req.query?.slug === 'string' ? req.query.slug.trim() : '';
  return (bodySlug || queryTenant || querySlug).toLowerCase();
}

/**
 * 공개 문의 폼 — ?tenant= / ?brand= 가 있으면 SK로 조용히 떨어지지 않음.
 * tenant 코드가 업체 slug가 아니면(예: tana) 호스트 업체의 브랜드 코드로 다시 찾음.
 */
export async function resolveLandingContactPublicScope(
  req: Request,
  brandSlug: string | null,
): Promise<{ tenantId: string; brandSlug: string | null }> {
  const requestedTenant = readRequestedTenantSlug(req);
  let tenantId: string | null = null;
  let tenantResolved = false;

  if (requestedTenant) {
    try {
      tenantId = (await resolveTenantBySlug(requestedTenant)).id;
      tenantResolved = true;
    } catch (e) {
      if (!(e instanceof TenantNotFoundError)) throw e;
    }
  }

  if (!tenantId) {
    const host = readRequestHost(req.headers as Record<string, unknown>);
    const hostSlug = resolveTenantSlugFromHost(host);
    if (hostSlug) {
      try {
        tenantId = (await resolveTenantBySlug(hostSlug)).id;
      } catch (e) {
        if (!(e instanceof TenantNotFoundError)) throw e;
      }
    }
  }

  const brandFromFailedTenant = !tenantResolved && requestedTenant ? requestedTenant : null;
  const resolvedBrand = brandSlug?.trim() || brandFromFailedTenant || null;

  if (!tenantId) {
    tenantId = DEFAULT_TENANT_ID;
  }

  return { tenantId, brandSlug: resolvedBrand };
}

export async function getOrCreateLandingContactFormConfig(
  tenantId: string,
  operatingCompanyId: string,
  db: Db = prisma,
) {
  const existing = await db.landingContactFormConfig.findFirst({
    where: { tenantId, operatingCompanyId },
  });
  if (existing) return existing;
  return db.landingContactFormConfig.create({
    data: {
      tenantId,
      operatingCompanyId,
      customFields: DEFAULT_LANDING_CONTACT_CUSTOM_FIELDS,
    },
  });
}
