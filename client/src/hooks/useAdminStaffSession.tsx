import { createContext, useContext, type ReactNode } from 'react';
import type { StaffAdminMeFields } from '../utils/staffAdminAccess';
import { hasMarketerPermission } from '@shared/marketerPermissions';

export type AdminStaffSessionValue = {
  /** /auth/me 완료 전 */
  ready: boolean;
  tenantName: string | null;
  role: string | null;
  staffMe: StaffAdminMeFields | null;
  isTenantOwner: boolean;
  isSuperAdmin: boolean;
  canCrmSettings: boolean;
};

const defaultValue: AdminStaffSessionValue = {
  ready: false,
  tenantName: null,
  role: null,
  staffMe: null,
  isTenantOwner: false,
  isSuperAdmin: false,
  canCrmSettings: false,
};

const AdminStaffSessionContext = createContext<AdminStaffSessionValue>(defaultValue);

export function AdminStaffSessionProvider({
  value,
  children,
}: {
  value: AdminStaffSessionValue;
  children: ReactNode;
}) {
  return <AdminStaffSessionContext.Provider value={value}>{children}</AdminStaffSessionContext.Provider>;
}

export function useAdminStaffSession(): AdminStaffSessionValue {
  return useContext(AdminStaffSessionContext);
}

/** /auth/me 응답에서 CRM 설정 링크 노출 여부 */
export function resolveCanCrmSettingsFromMe(u: {
  role?: string;
  marketerPermissions?: StaffAdminMeFields['marketerPermissions'];
}): boolean {
  const role = typeof u.role === 'string' ? u.role : null;
  if (role === 'ADMIN') return true;
  if (role === 'MARKETER' && u.marketerPermissions) {
    return hasMarketerPermission(role, u.marketerPermissions, 'crm.settings');
  }
  return false;
}
