import type { PrismaClient } from '@prisma/client';
import {
  ensureDefaultTenantProfessionalDefaults,
  profOptionKey,
  seedProfessionalDefaultsForTenant,
} from '../tenants/tenantConfigSeed.service.js';

/** @deprecated use seedProfessionalDefaultsForTenant / ensureDefaultTenantProfessionalDefaults */
export { DEFAULT_PROFESSIONAL_OPTIONS } from './defaultProfessionalOptions.data.js';

/** `npm run db:seed` — SK 기본 테넌트 전문 시공 옵션 */
export async function seedProfessionalDefaults(prisma: PrismaClient, tenantId: string): Promise<void> {
  await seedProfessionalDefaultsForTenant(prisma, tenantId);
}

/** 서버 기동 시 — SK 기본 테넌트 id가 없을 때만 생성 */
export async function ensureMissingProfessionalDefaults(prisma: PrismaClient): Promise<void> {
  await ensureDefaultTenantProfessionalDefaults(prisma);
}

export { profOptionKey };
