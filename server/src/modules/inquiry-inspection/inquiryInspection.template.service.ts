import {
  buildDefaultTenantTemplateSnapshot,
  compactTenantInspectionAreaItems,
  INSPECTION_TEMPLATE_AREA_CATALOG,
  mergeEffectiveInspectionTemplate,
  sanitizeTenantInspectionAreaItems,
  type TenantInspectionAreaItems,
} from '../../lib/inquiryInspectionTenantTemplate.js';
import { getTenantConfig, updateTenantConfig } from '../tenants/tenantConfig.service.js';

export async function getInspectionTemplateForTenant(tenantId: string) {
  const config = await getTenantConfig(tenantId);
  const custom = config.inspection?.areaItems ?? null;
  const defaults = buildDefaultTenantTemplateSnapshot();
  const effective = mergeEffectiveInspectionTemplate(custom);
  return {
    catalog: INSPECTION_TEMPLATE_AREA_CATALOG,
    defaults,
    custom,
    effective,
  };
}

export async function saveInspectionTemplateForTenant(
  tenantId: string,
  effectiveAreaItems: TenantInspectionAreaItems,
) {
  const sanitized = sanitizeTenantInspectionAreaItems(effectiveAreaItems);
  const compact = compactTenantInspectionAreaItems(sanitized);
  const updated = await updateTenantConfig(tenantId, {
    inspection: compact ? { areaItems: compact } : {},
  });
  return getInspectionTemplateForTenant(tenantId).then((view) => ({
    ...view,
    config: updated.inspection ?? null,
  }));
}

export async function resetInspectionTemplateForTenant(tenantId: string) {
  await updateTenantConfig(tenantId, { inspection: {} });
  return getInspectionTemplateForTenant(tenantId);
}
