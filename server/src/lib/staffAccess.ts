/**
 * @generated-sync from shared/staffAccess.ts — 직접 수정하지 마세요.
 * 변경: shared/staffAccess.ts 수정 후 동기화.
 */

/** L1 Tenant.config.access — 직원 권한 정책 */

export type TenantAccessConfig = {
  /** true: MARKETER도 ADMIN과 동일한 업무 API·관리 메뉴 (업체 소유자 전용 기능 제외) */
  marketerAdminAccess?: boolean;
};

export function isMarketerAdminAccessEnabled(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  const access = (config as { access?: TenantAccessConfig }).access;
  return access?.marketerAdminAccess === true;
}

/** ADMIN 또는 (MARKETER + 테넌트 승격 설정) */
export function hasEffectiveStaffAdminAccess(
  role: string | null | undefined,
  marketerAdminAccess: boolean,
): boolean {
  if (role === 'ADMIN') return true;
  return role === 'MARKETER' && marketerAdminAccess;
}
