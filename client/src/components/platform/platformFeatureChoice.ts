import { TENANT_FEATURE_MODULES, type TenantFeatureModuleId } from '@shared/tenantFeatureModules';
import { TENANT_NAV_FEATURE_CATALOG, tenantNavPathVisibility } from '@shared/tenantNavFeatureCatalog';
import { getModuleVisibility } from '@shared/tenantModuleVisibility';
import type { PlatformTenantFeatureRow } from '../../api/platformTenants';

export type FeatureSelectMode = 'inherit' | 'on' | 'off';

function isKnownModule(id: string): id is TenantFeatureModuleId {
  return Object.prototype.hasOwnProperty.call(TENANT_FEATURE_MODULES, id);
}

export function featureSelectMode(row: PlatformTenantFeatureRow): FeatureSelectMode {
  if (row.locked) return 'inherit';
  if (row.override === true) return 'on';
  if (row.override === false) return 'off';
  if (row.override == null && row.enabled && !row.inPlan) return 'on';
  if (row.override == null && row.inPlan && row.enabled === false && row.effective === false) return 'off';
  return 'inherit';
}

export function previewEffective(row: PlatformTenantFeatureRow, mode: FeatureSelectMode): boolean {
  if (row.locked) return true;
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return row.inPlan;
}

export function planExcludedReason(moduleId: string, plan: string): string {
  if (!isKnownModule(moduleId)) return '플랜 미포함(꺼짐)';
  const vis = getModuleVisibility(moduleId, plan, []);
  if (vis.requiredPlanLabel) return `${vis.requiredPlanLabel}부터`;
  return '플랜 미포함(꺼짐)';
}

/** 모듈은 켜져 있는데 그 모듈의 메뉴 경로가 전부 숨김일 때만 */
export function menusAllHidden(moduleId: string, plan: string, enabledModules: readonly string[]): boolean {
  const rows = TENANT_NAV_FEATURE_CATALOG.flatMap((category) => category.rows).filter(
    (row) => row.moduleId === moduleId,
  );
  if (rows.length === 0) return false;
  return rows.every((row) => tenantNavPathVisibility(row.path, plan, enabledModules).state === 'hidden');
}

export function previewReason(
  row: PlatformTenantFeatureRow,
  mode: FeatureSelectMode,
  plan: string,
  enabledModules: readonly string[],
): string {
  if (row.locked) return '필수 기능';
  const effective = previewEffective(row, mode);
  if (effective && menusAllHidden(row.moduleId, plan, enabledModules)) return '메뉴 숨김';
  if (mode === 'on' && !row.inPlan) return '개별 켜기';
  if (mode === 'off' && row.inPlan) return '개별 끄기';
  if (effective && row.inPlan) return '플랜 기본(켜짐)';
  return planExcludedReason(row.moduleId, plan);
}

export function shouldPersistFeatureChoice(row: PlatformTenantFeatureRow, mode: FeatureSelectMode): boolean {
  if (row.locked) return false;
  if (mode === 'on' && !row.inPlan) return true;
  if (mode === 'off' && row.inPlan) return true;
  return false;
}
