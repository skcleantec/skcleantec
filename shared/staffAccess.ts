/** L1 Tenant.config.access — 직원 권한 정책 (레거시 테넌트 전역 설정) */

import type { MarketerAdminLevel } from './marketerAdminLevel.js';
import { hasMarketerFullAdminAccess } from './marketerAdminLevel.js';

export type TenantAccessConfig = {
  /** @deprecated per-user marketerAdminLevel 사용. true면 레거시 호환용 FULL 취급 */
  marketerAdminAccess?: boolean;
};

export function isMarketerAdminAccessEnabled(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  const access = (config as { access?: TenantAccessConfig }).access;
  return access?.marketerAdminAccess === true;
}

/** ADMIN 또는 (MARKETER + FULL) — GNB 관리자 전용 메뉴 */
export function hasEffectiveStaffAdminAccess(
  role: string | null | undefined,
  marketerAdminLevel: MarketerAdminLevel | boolean | null | undefined,
): boolean {
  if (typeof marketerAdminLevel === 'boolean') {
    return hasMarketerFullAdminAccess(role, marketerAdminLevel ? 'FULL' : 'NONE');
  }
  return hasMarketerFullAdminAccess(role, marketerAdminLevel ?? 'NONE');
}
