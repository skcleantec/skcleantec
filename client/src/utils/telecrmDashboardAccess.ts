import { canShowAdminGnbItem } from '@shared/marketerPermissionNav';
import type { MarketerPermissionMap } from '@shared/marketerPermissions';
import { hasFeature } from '@shared/tenantFeatureModules';

/** 대시보드 텔레CRM 카드 — GNB와 동일 조건 (mod_telecrm + crm.view/settings) */
export function canShowTelecrmDashboard(opts: {
  enabledModules: readonly string[] | null;
  role: string | null | undefined;
  marketerPermissions: MarketerPermissionMap | null | undefined;
}): boolean {
  const { enabledModules, role, marketerPermissions } = opts;
  if (enabledModules && !hasFeature(enabledModules, 'mod_telecrm')) return false;
  if (role === 'MARKETER' && marketerPermissions) {
    return canShowAdminGnbItem('telecrm', role, marketerPermissions);
  }
  return true;
}
