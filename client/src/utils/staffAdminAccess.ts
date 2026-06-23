import { hasEffectiveStaffAdminAccess } from '@shared/staffAccess';

export { hasEffectiveStaffAdminAccess };

export type StaffAdminMeFields = {
  role?: string | null;
  effectiveStaffAdminAccess?: boolean;
  marketerAdminAccess?: boolean;
};

/** /auth/me 응답 기준 — GNB·관리자 전용 메뉴 노출 */
export function resolveEffectiveStaffAdminFromMe(me: StaffAdminMeFields | null | undefined): boolean {
  if (!me) return false;
  if (me.effectiveStaffAdminAccess === true) return true;
  return hasEffectiveStaffAdminAccess(me.role, Boolean(me.marketerAdminAccess));
}
