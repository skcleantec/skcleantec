/**
 * Standard+ 플랜 — Premium 업무 기능 전체(텔레CRM 제외) 반영
 *
 * 실행:
 *   cd server && npx tsx scripts/migrate-standard-plus-full-features.ts
 *   cd server && npx tsx scripts/migrate-standard-plus-full-features.ts --apply
 */
import '../src/env.js';
import { prisma } from '../src/lib/prisma.js';
import { resetTenantFeaturesFromPlan } from '../src/modules/platform/tenantProvisioning.service.js';
import { modulesForPlan } from '../src/modules/tenants/tenantFeatureCatalog.js';
import { getEffectiveEnabledModules } from '../src/modules/tenants/tenantFeatures.service.js';

const APPLY = process.argv.includes('--apply');

const NEW_MODULES = modulesForPlan('standard_plus');

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { plan: 'standard_plus' },
    select: { id: true, slug: true, name: true, plan: true },
    orderBy: { slug: 'asc' },
  });

  console.log(`Standard+ tenants: ${tenants.length}`);
  console.log(`Target modules (${NEW_MODULES.length}): ${NEW_MODULES.join(', ')}`);
  console.log(APPLY ? 'MODE: apply' : 'MODE: dry-run');

  for (const tenant of tenants) {
    const before = await getEffectiveEnabledModules(tenant.id);
    const missing = NEW_MODULES.filter((m) => !before.includes(m));
    const extra = before.filter((m) => !NEW_MODULES.includes(m) && m !== 'mod_telecrm');

    console.log(`\n[${tenant.slug}] ${tenant.name}`);
    console.log(`  before: ${before.length} modules`);
    if (missing.length) console.log(`  + add: ${missing.join(', ')}`);
    if (extra.length) console.log(`  - drop (non-telecrm): ${extra.join(', ')}`);

    if (APPLY) {
      await resetTenantFeaturesFromPlan(tenant.id);
      const after = await getEffectiveEnabledModules(tenant.id);
      console.log(`  applied → ${after.length} modules`);
    }
  }

  if (!APPLY) {
    console.log('\n(dry-run) Apply with: npx tsx scripts/migrate-standard-plus-full-features.ts --apply');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
