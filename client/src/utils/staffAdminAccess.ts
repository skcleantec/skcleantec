import { hasEffectiveStaffAdminAccess } from '@shared/staffAccess';
import type { MarketerAdminLevel } from '@shared/marketerAdminLevel';
import type { MarketerPermissionId, MarketerPermissionMap } from '@shared/marketerPermissions';
import {
  hasMarketerAdminMenuAccessFromMap,
  hasMarketerOperationalAccessFromMap,
  hasMarketerPermission,
} from '@shared/marketerPermissions';

export { hasEffectiveStaffAdminAccess };

export type StaffAdminMeFields = {
  role?: string | null;
  effectiveStaffAdminAccess?: boolean;
  marketerAdminLevel?: MarketerAdminLevel | null;
  marketerPermissions?: MarketerPermissionMap | null;
  /** @deprecated marketerAdminLevel 사용 */
  marketerAdminAccess?: boolean;
  marketerOperationalAdminAccess?: boolean;
};

export function hasStaffPermission(
  me: StaffAdminMeFields | null | undefined,
  permissionId: MarketerPermissionId,
): boolean {
  if (!me) return false;
  if (me.role === 'ADMIN') return true;
  if (me.role !== 'MARKETER' || !me.marketerPermissions) return false;
  return hasMarketerPermission(me.role, me.marketerPermissions, permissionId);
}

/** /auth/me — 접수 단건 삭제(inquiry.delete) */
export function canDeleteInquiryFromMe(me: StaffAdminMeFields | null | undefined): boolean {
  return hasStaffPermission(me, 'inquiry.delete');
}

/** /auth/me — 접수 일괄 삭제(inquiry.bulkDelete) */
export function canBulkDeleteInquiriesFromMe(me: StaffAdminMeFields | null | undefined): boolean {
  return hasStaffPermission(me, 'inquiry.bulkDelete');
}

/** /auth/me — GNB·관리자 전용 메뉴(FULL·ADMIN 또는 admin.* 권한) */
export function resolveEffectiveStaffAdminFromMe(me: StaffAdminMeFields | null | undefined): boolean {
  if (!me) return false;
  if (me.effectiveStaffAdminAccess === true) return true;
  if (me.role === 'ADMIN') return true;
  if (me.marketerPermissions && me.role === 'MARKETER') {
    return hasMarketerAdminMenuAccessFromMap(me.role, me.marketerPermissions);
  }
  if (me.marketerAdminLevel != null) {
    return hasEffectiveStaffAdminAccess(me.role, me.marketerAdminLevel);
  }
  return hasEffectiveStaffAdminAccess(me.role, Boolean(me.marketerAdminAccess));
}

/** /auth/me — 배정·삭제 등 운영 권한 */
export function resolveMarketerOperationalAdminFromMe(
  me: StaffAdminMeFields | null | undefined,
): boolean {
  if (!me) return false;
  if (me.marketerOperationalAdminAccess === true) return true;
  if (me.role === 'ADMIN') return true;
  if (me.marketerPermissions && me.role === 'MARKETER') {
    return hasMarketerOperationalAccessFromMap(me.role, me.marketerPermissions);
  }
  if (me.marketerAdminLevel != null && me.role === 'MARKETER') {
    return me.marketerAdminLevel === 'LIMITED' || me.marketerAdminLevel === 'FULL';
  }
  return Boolean(me.marketerAdminAccess);
}
