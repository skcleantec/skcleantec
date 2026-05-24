import type { AuthPayload } from './auth.middleware.js';

/** 테넌트 최고 권한(업체 소유 ADMIN) — JWT `isTenantOwner` 또는 DB 플래그 */
export function isTenantOwnerAdmin(user: AuthPayload | undefined): boolean {
  if (!user || user.role !== 'ADMIN') return false;
  return user.isTenantOwner === true;
}
