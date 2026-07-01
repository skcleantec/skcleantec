import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import type { StaffAdminMeFields } from '../../utils/staffAdminAccess';

const DELEGATED_PREFIXES = [
  '/admin/inquiries',
  '/admin/team-leaders',
  '/admin/advertising',
  '/admin/crm/settings',
] as const;

function isDelegatedAdminPath(pathname: string): boolean {
  return DELEGATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** 하위 레이아웃(inquiries·team-leaders·advertising)이 아닌 GNB 직접 경로 권한 */
export function AdminStaffPathGate({
  staffMe,
  children,
}: {
  staffMe: StaffAdminMeFields | null;
  children: ReactNode;
}) {
  const { pathname } = useLocation();

  const allowed = useMemo(() => {
    if (!staffMe?.role || staffMe.role === 'ADMIN') return true;
    if (isDelegatedAdminPath(pathname)) return true;
    return canAccessAdminPath(staffMe.role, staffMe.marketerPermissions, pathname);
  }, [staffMe, pathname]);

  if (staffMe && !allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-fluid-sm text-amber-900">
        이 화면에 대한 권한이 없습니다.
      </div>
    );
  }

  return <>{children}</>;
}
