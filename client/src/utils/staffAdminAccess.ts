import { hasEffectiveStaffAdminAccess } from '@shared/staffAccess';
import type { MarketerAdminLevel } from '@shared/marketerAdminLevel';
import { hasMarketerOperationalAdminAccess } from '@shared/marketerAdminLevel';

export { hasEffectiveStaffAdminAccess };

export type StaffAdminMeFields = {
  role?: string | null;
  effectiveStaffAdminAccess?: boolean;
  marketerAdminLevel?: MarketerAdminLevel | null;
  /** @deprecated marketerAdminLevel 사용 */
  marketerAdminAccess?: boolean;
  marketerOperationalAdminAccess?: boolean;
};

/** /auth/me — GNB·관리자 전용 메뉴(FULL·ADMIN) */
export function resolveEffectiveStaffAdminFromMe(me: StaffAdminMeFields | null | undefined): boolean {
  if (!me) return false;
  if (me.effectiveStaffAdminAccess === true) return true;
  if (me.marketerAdminLevel != null) {
    return hasEffectiveStaffAdminAccess(me.role, me.marketerAdminLevel);
  }
  return hasEffectiveStaffAdminAccess(me.role, Boolean(me.marketerAdminAccess));
}

/** /auth/me — 배정·삭제 등 운영 권한(LIMITED·FULL·ADMIN) */
export function resolveMarketerOperationalAdminFromMe(
  me: StaffAdminMeFields | null | undefined,
): boolean {
  if (!me) return false;
  if (me.marketerOperationalAdminAccess === true) return true;
  if (me.marketerAdminLevel != null) {
    return hasMarketerOperationalAdminAccess(me.role, me.marketerAdminLevel);
  }
  if (me.role === 'ADMIN') return true;
  return Boolean(me.marketerAdminAccess);
}
