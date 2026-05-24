import { config } from '../../config/index.js';

/** 최고 관리자 식별용 이메일 (기본: admin 계정). 환경변수 SUPER_ADMIN_EMAIL 로 변경 가능 */
export function normalizeSuperAdminEmail(email: string): string {
  return String(email).trim().toLowerCase();
}

/** @deprecated Phase 5 이후 테넌트 특권은 `isTenantOwnerAdmin` / `User.isTenantOwner` 사용. 플랫폼은 PlatformUser. */
export function isSuperAdminEmail(email: string): boolean {
  return normalizeSuperAdminEmail(email) === normalizeSuperAdminEmail(config.superAdminEmail);
}

/** @deprecated `isTenantOwnerAdmin` 사용 */
export function isSuperAdminRoleAndEmail(role: string, email: string): boolean {
  return role === 'ADMIN' && isSuperAdminEmail(email);
}
