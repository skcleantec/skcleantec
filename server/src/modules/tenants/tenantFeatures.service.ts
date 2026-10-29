import { prisma } from '../../lib/prisma.js';
import { isBarobillOpenForTenant } from '../../lib/barobill/barobillOpen.js';
import { CASHBILL_MODULE_ID } from '../../lib/barobill/policy.js';
import {
  applyExternalCompanyModuleAccess,
  CORE_FEATURE_MODULE_IDS,
  isCustomModuleId,
  isKnownFeatureModuleId,
  modulesForPlan,
  type TenantFeatureModuleId,
} from './tenantFeatureCatalog.js';

export async function getTenantPlan(tenantId: string): Promise<string> {
  const row = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  return row?.plan ?? 'standard';
}

/** plan 기본 + TenantFeature 오버라이드 → effective enabled module ids (표준 + custom_*) */
export async function getEffectiveEnabledModules(tenantId: string): Promise<string[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, slug: true },
  });
  const plan = tenant?.plan ?? 'standard';
  const base = new Set<string>(modulesForPlan(plan));

  const overrides = await prisma.tenantFeature.findMany({
    where: { tenantId },
    select: { moduleId: true, enabled: true },
  });

  for (const row of overrides) {
    if (isCustomModuleId(row.moduleId)) {
      if (row.enabled) base.add(row.moduleId);
      else base.delete(row.moduleId);
      continue;
    }
    if (!isKnownFeatureModuleId(row.moduleId)) continue;
    const id = row.moduleId;
    if (CORE_FEATURE_MODULE_IDS.has(id)) continue;
    if (row.enabled) base.add(id);
    else base.delete(id);
  }

  for (const core of CORE_FEATURE_MODULE_IDS) {
    base.add(core);
  }

  const modules = applyExternalCompanyModuleAccess([...base], tenant?.slug);
  if (!isBarobillOpenForTenant(tenantId)) {
    return modules.filter((id) => id !== CASHBILL_MODULE_ID);
  }
  return modules;
}

export async function isFeatureEnabled(
  tenantId: string,
  moduleId: TenantFeatureModuleId,
): Promise<boolean> {
  const enabled = await getEffectiveEnabledModules(tenantId);
  return enabled.includes(moduleId);
}

import { getTenantConfig } from './tenantConfig.service.js';

export async function getTenantCapabilities(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  const [modules, config] = await Promise.all([
    getEffectiveEnabledModules(tenantId),
    getTenantConfig(tenantId),
  ]);
  return { plan: tenant?.plan ?? 'standard', modules, config };
}
