import { canShowAdminGnbItem } from '@shared/marketerPermissionNav';
import type { MarketerPermissionMap } from '@shared/marketerPermissions';
import type { TelecrmUserCapabilities } from '@shared/telecrmTenantPolicy';

/** 대시보드 텔레CRM 카드 노출 — mod_telecrm 여부와 무관, GNB와 동일 권한만 확인 */
export function canShowTelecrmDashboard(opts: {
  role: string | null | undefined;
  marketerPermissions: MarketerPermissionMap | null | undefined;
}): boolean {
  const { role, marketerPermissions } = opts;
  if (role === 'MARKETER' && marketerPermissions) {
    return canShowAdminGnbItem('telecrm', role, marketerPermissions);
  }
  return role === 'ADMIN';
}

/** 텔레CRM 실제 열기 — 라이선스 + 허용 목록 */
export function canAccessTelecrm(telecrm: TelecrmUserCapabilities | null | undefined): boolean {
  return Boolean(telecrm?.licensed && telecrm.canAccess);
}

export function telecrmHasPlatform(
  telecrm: TelecrmUserCapabilities | null | undefined,
  platform: 'soomgo' | 'miso',
): boolean {
  if (!telecrm?.licensed) return false;
  return telecrm.platforms.includes(platform);
}
