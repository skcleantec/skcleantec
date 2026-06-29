/**
 * 전문 시공 isActive=false 가 seed 에 의해 되살아나지 않는지 검증
 * cd server && npx tsx scripts/verify-prof-option-deactivate-persist.ts
 */
import './loadServerEnv.js';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_ID } from '../src/modules/tenants/tenant.constants.js';
import { seedProfessionalDefaultsForTenant } from '../src/modules/tenants/tenantConfigSeed.service.js';
import { profOptionKey } from '../src/modules/tenants/tenantConfigSeed.service.js';

const TARGET_ID = 'newhouse_syndrome';

const prisma = new PrismaClient();

async function main() {
  await seedProfessionalDefaultsForTenant(prisma, DEFAULT_TENANT_ID);
  await prisma.professionalSpecialtyOption.update({
    where: profOptionKey(DEFAULT_TENANT_ID, TARGET_ID),
    data: { isActive: false },
  });
  await seedProfessionalDefaultsForTenant(prisma, DEFAULT_TENANT_ID);
  const row = await prisma.professionalSpecialtyOption.findUnique({
    where: profOptionKey(DEFAULT_TENANT_ID, TARGET_ID),
    select: { isActive: true, label: true },
  });
  if (!row || row.isActive !== false) {
    throw new Error(`expected ${TARGET_ID} isActive=false after re-seed, got ${String(row?.isActive)}`);
  }
  await prisma.professionalSpecialtyOption.update({
    where: profOptionKey(DEFAULT_TENANT_ID, TARGET_ID),
    data: { isActive: true },
  });
  console.info('[verify-prof-option-deactivate-persist] OK — seed does not reset isActive');
}

main()
  .catch((e) => {
    console.error('[verify-prof-option-deactivate-persist] FAIL', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
