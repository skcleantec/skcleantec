import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultOperatingCompanyId } from '../operating-companies/operatingCompany.service.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { DEFAULT_LANDING_CONTACT_CUSTOM_FIELDS } from './landingContactForm.schema.js';

type Db = PrismaClient;

export async function assertLandingContactFeatureEnabled(tenantId: string): Promise<boolean> {
  return isFeatureEnabled(tenantId, 'mod_landing_inquiry');
}

export async function resolveLandingContactOperatingCompanyId(
  tenantId: string,
  brandSlug: string | null | undefined,
  db: Db = prisma,
): Promise<string> {
  const slug = brandSlug?.trim().toLowerCase();
  if (slug) {
    const bySlug = await db.operatingCompany.findFirst({
      where: { tenantId, slug, isActive: true },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
  }
  return getDefaultOperatingCompanyId(db, tenantId);
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
