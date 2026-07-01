import type { MarketerPermissionId, MarketerPermissionMap } from './marketerPermissions.js';
import {
  ADMIN_MENU_MARKETER_PERMISSION_IDS,
  hasMarketerPermission,
} from './marketerPermissions.js';

export type AdminNavId =
  | 'dashboard'
  | 'inquiries'
  | 'schedule'
  | 'db-marketplace'
  | 'team-leaders'
  | 'advertising'
  | 'messages';

/** GNB 항목 — 마케터는 하나라도 있으면 표시 */
export const ADMIN_GNB_PERMISSIONS: Record<AdminNavId, readonly MarketerPermissionId[]> = {
  dashboard: ['inquiry.view'],
  inquiries: ['inquiry.view'],
  schedule: ['schedule.edit.inquiry'],
  'db-marketplace': ['marketplace.view'],
  'team-leaders': ADMIN_MENU_MARKETER_PERMISSION_IDS,
  advertising: ['ads.sessions', 'ads.analytics', 'ads.settings'],
  messages: ['messages.send'],
};

export type AdminPathPermissionRule = {
  /** pathname prefix (긴 경로 우선 매칭) */
  prefix: string;
  permissions: readonly MarketerPermissionId[];
  /** true면 JWT role=ADMIN 만 (마케터 GNB·사이드 숨김) */
  adminRoleOnly?: boolean;
};

/** `/admin/*` 하위 경로 — 긴 prefix 가 위에 오도록 정렬 유지 */
export const ADMIN_PATH_PERMISSION_RULES: AdminPathPermissionRule[] = [
  { prefix: '/admin/team-leaders/staff-access', permissions: [], adminRoleOnly: true },
  { prefix: '/admin/team-leaders/team-leader-training', permissions: ['admin.users'], adminRoleOnly: true },
  { prefix: '/admin/team-leaders/company-profile', permissions: ['admin.companyProfile'] },
  { prefix: '/admin/team-leaders/operating-policy', permissions: ['admin.pageSettings'] },
  { prefix: '/admin/team-leaders/page-settings', permissions: ['admin.pageSettings'] },
  { prefix: '/admin/team-leaders/inspection-template', permissions: ['admin.inspectionTemplate'] },
  { prefix: '/admin/team-leaders/e-contracts', permissions: ['admin.eContract'] },
  { prefix: '/admin/team-leaders/tenant-partners', permissions: ['admin.tenantPartners'] },
  { prefix: '/admin/team-leaders/tenant-partner-settlement', permissions: ['admin.externalSettlement'] },
  { prefix: '/admin/team-leaders/external-settlement', permissions: ['admin.externalSettlement'] },
  { prefix: '/admin/team-leaders/payroll', permissions: ['admin.payroll'] },
  { prefix: '/admin/team-leaders/external-companies', permissions: ['admin.users'] },
  { prefix: '/admin/team-leaders/operating-companies', permissions: ['admin.users'] },
  { prefix: '/admin/team-leaders/leader-stats', permissions: ['admin.users'] },
  { prefix: '/admin/team-leaders/team-members', permissions: ['admin.users'] },
  { prefix: '/admin/team-leaders/holiday-calendar', permissions: ['admin.users'] },
  { prefix: '/admin/team-leaders', permissions: ['admin.users'] },
  { prefix: '/admin/service-zones', permissions: ['admin.serviceZones'] },
  { prefix: '/admin/inquiries/bulk-excel', permissions: ['inquiry.excelImport'] },
  { prefix: '/admin/inquiries/order-templates', permissions: ['orderform.templates'] },
  { prefix: '/admin/inquiries/order-customer-preview', permissions: ['orderform.formConfig'] },
  { prefix: '/admin/inquiries/order-customer-link', permissions: ['orderform.formConfig'] },
  { prefix: '/admin/inquiries/order-issue', permissions: ['orderform.issue'] },
  { prefix: '/admin/inquiries/order-forms', permissions: ['orderform.issue'] },
  { prefix: '/admin/inquiries/quotations/settings', permissions: ['quotation.config'] },
  { prefix: '/admin/inquiries/quotations/new', permissions: ['quotation.create'] },
  { prefix: '/admin/inquiries/quotations', permissions: ['quotation.create'] },
  { prefix: '/admin/inquiries/followup', permissions: ['followup.view'] },
  { prefix: '/admin/inquiries/review-payback', permissions: ['inquiry.view'] },
  { prefix: '/admin/inquiries/cs', permissions: ['cs.view'] },
  { prefix: '/admin/inquiries', permissions: ['inquiry.view'] },
  { prefix: '/admin/advertising/settings', permissions: ['ads.settings'] },
  { prefix: '/admin/advertising', permissions: ['ads.sessions', 'ads.analytics', 'ads.settings'] },
  { prefix: '/admin/db-marketplace', permissions: ['marketplace.view'] },
  { prefix: '/admin/messages', permissions: ['messages.send'] },
  { prefix: '/admin/schedule', permissions: ['schedule.edit.inquiry'] },
  { prefix: '/admin/dashboard', permissions: ['inquiry.view'] },
];

export function resolveAdminPathPermissionRule(pathname: string): AdminPathPermissionRule | null {
  const path = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  for (const rule of ADMIN_PATH_PERMISSION_RULES) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) return rule;
  }
  return null;
}

export function canAccessAdminPath(
  role: string | null | undefined,
  permissions: MarketerPermissionMap | null | undefined,
  pathname: string,
): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (role !== 'MARKETER') return false;
  const rule = resolveAdminPathPermissionRule(pathname);
  if (!rule) return true;
  if (rule.adminRoleOnly) return false;
  if (!permissions) return false;
  if (rule.permissions.length === 0) return false;
  return rule.permissions.some((id) => hasMarketerPermission(role, permissions, id));
}

export function canShowAdminGnbItem(
  navId: AdminNavId,
  role: string | null | undefined,
  permissions: MarketerPermissionMap | null | undefined,
): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (role !== 'MARKETER' || !permissions) return false;
  const required = ADMIN_GNB_PERMISSIONS[navId];
  return required.some((id) => hasMarketerPermission(role, permissions, id));
}

export function hasAnyAdminMenuPermission(
  role: string | null | undefined,
  permissions: MarketerPermissionMap | null | undefined,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MARKETER' || !permissions) return false;
  return ADMIN_MENU_MARKETER_PERMISSION_IDS.some((id) =>
    hasMarketerPermission(role, permissions, id),
  );
}
