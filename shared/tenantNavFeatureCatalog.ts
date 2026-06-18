/**
 * 테넌트 관리자 화면·하위 메뉴 ↔ 기능 모듈 카탈로그 (플랫폼 설정 UI·GNB/사이드 필터)
 * @see docs/MULTI_TENANT_PLATFORM.md
 */

import { hasFeature, type TenantFeatureModuleId } from './tenantFeatureModules.js';

export type TenantNavFeatureRow = {
  label: string;
  path: string;
  moduleId: TenantFeatureModuleId | null;
  /** 사이드/탭 그룹 표시용 (발주서, 견적서 등) */
  group?: string;
};

export type TenantNavFeatureCategory = {
  id: string;
  label: string;
  /** GNB·영역 설명 */
  subtitle?: string;
  adminOnly?: boolean;
  rows: TenantNavFeatureRow[];
};

export const TENANT_NAV_FEATURE_CATALOG: TenantNavFeatureCategory[] = [
  {
    id: 'common',
    label: '공통',
    rows: [{ label: '대시보드', path: '/admin/dashboard', moduleId: null }],
  },
  {
    id: 'inquiries',
    label: '서비스접수',
    subtitle: 'GNB · 서비스접수',
    rows: [
      { label: '접수목록', path: '/admin/inquiries', moduleId: 'core_inquiries' },
      { label: '부재·보류', path: '/admin/inquiries/followup', moduleId: 'core_inquiries' },
      { label: '페이백/리뷰', path: '/admin/inquiries/review-payback', moduleId: 'core_inquiries' },
      { label: '발주서 목록', path: '/admin/inquiries/order-forms', moduleId: 'core_inquiries', group: '발주서' },
      { label: '발주서 발급', path: '/admin/inquiries/order-issue', moduleId: 'core_inquiries', group: '발주서' },
      { label: '발주서 양식', path: '/admin/inquiries/order-templates', moduleId: 'core_inquiries', group: '발주서' },
      {
        label: '발주서설정',
        path: '/admin/inquiries/order-customer-preview',
        moduleId: 'core_inquiries',
        group: '발주서',
      },
      { label: '견적 목록', path: '/admin/inquiries/quotations', moduleId: 'core_inquiries', group: '견적서' },
      { label: '견적 작성', path: '/admin/inquiries/quotations/new', moduleId: 'core_inquiries', group: '견적서' },
      { label: '견적 설정', path: '/admin/inquiries/quotations/settings', moduleId: 'core_inquiries', group: '견적서' },
    ],
  },
  {
    id: 'schedule',
    label: '스케줄',
    subtitle: 'GNB · 스케줄',
    rows: [{ label: '스케줄', path: '/admin/schedule', moduleId: 'core_schedule' }],
  },
  {
    id: 'cs',
    label: 'C/S 관리',
    subtitle: 'GNB · C/S 관리',
    rows: [{ label: 'C/S 관리', path: '/admin/cs', moduleId: 'mod_cs' }],
  },
  {
    id: 'advertising',
    label: '광고비',
    subtitle: 'GNB · 광고비',
    rows: [
      { label: '광고비', path: '/admin/advertising', moduleId: 'mod_advertising' },
      { label: '광고비 설정', path: '/admin/advertising/settings', moduleId: 'mod_advertising', group: '설정' },
    ],
  },
  {
    id: 'messages',
    label: '메시지',
    subtitle: 'GNB · 메시지',
    rows: [{ label: '메시지', path: '/admin/messages', moduleId: 'core_messages' }],
  },
  {
    id: 'team-leaders',
    label: '관리자 전용',
    subtitle: 'GNB · 관리자 전용 (ADMIN)',
    adminOnly: true,
    rows: [
      { label: '업체등록정보', path: '/admin/team-leaders/company-profile', moduleId: null },
      { label: '사용자 등록', path: '/admin/team-leaders', moduleId: null, group: '사용자등록' },
      { label: '영업브랜드', path: '/admin/team-leaders/operating-companies', moduleId: null, group: '사용자등록' },
      {
        label: '타업체등록',
        path: '/admin/team-leaders/external-companies',
        moduleId: 'mod_external_co',
        group: '사용자등록',
      },
      {
        label: '파트너연결',
        path: '/admin/team-leaders/tenant-partners',
        moduleId: 'mod_tenant_exchange',
        group: '사용자등록',
      },
      {
        label: '전자계약',
        path: '/admin/team-leaders/e-contracts',
        moduleId: 'mod_e_contract',
        group: '사용자등록',
      },
      {
        label: '계약서',
        path: '/admin/team-leaders/e-contracts',
        moduleId: 'mod_e_contract',
        group: '전자계약',
      },
      {
        label: '매핑 필드',
        path: '/admin/team-leaders/e-contracts/field-settings',
        moduleId: 'mod_e_contract',
        group: '전자계약',
      },
      {
        label: '발행측 정보',
        path: '/admin/team-leaders/e-contracts/issuer-profile',
        moduleId: 'mod_e_contract',
        group: '전자계약',
      },
      {
        label: '체결 기록',
        path: '/admin/team-leaders/e-contracts/overview',
        moduleId: 'mod_e_contract',
        group: '전자계약',
      },
      {
        label: '타업체정산',
        path: '/admin/team-leaders/external-settlement',
        moduleId: 'mod_external_co',
        group: '정산',
      },
      {
        label: '파트너정산',
        path: '/admin/team-leaders/tenant-partner-settlement',
        moduleId: 'mod_tenant_exchange',
        group: '정산',
      },
      { label: '월정산표', path: '/admin/team-leaders/payroll', moduleId: 'mod_payroll', group: '정산' },
      { label: '팀장', path: '/admin/team-leaders/leader-stats', moduleId: 'mod_team_stats', group: '직원관리' },
      { label: '팀원', path: '/admin/team-leaders/team-members', moduleId: null, group: '직원관리' },
      { label: '휴일캘린더', path: '/admin/team-leaders/holiday-calendar', moduleId: null, group: '직원관리' },
      { label: '페이지설정', path: '/admin/team-leaders/page-settings', moduleId: null, group: '설정' },
      { label: '브랜드정책', path: '/admin/team-leaders/operating-policy', moduleId: null, group: '설정' },
      {
        label: '검수템플릿',
        path: '/admin/team-leaders/inspection-template',
        moduleId: 'mod_inspection',
        group: '설정',
      },
    ],
  },
];

const PATH_MODULE_ROWS = TENANT_NAV_FEATURE_CATALOG.flatMap((c) => c.rows).sort(
  (a, b) => b.path.length - a.path.length,
);

/** 경로 → 모듈 (없으면 null = 항상 노출) */
export function moduleIdForTenantNavPath(pathname: string): TenantFeatureModuleId | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  for (const row of PATH_MODULE_ROWS) {
    const p = row.path.replace(/\/+$/, '') || '/';
    if (normalized === p || normalized.startsWith(`${p}/`)) {
      return row.moduleId;
    }
  }
  return null;
}

export function canShowTenantNavPath(
  pathname: string,
  enabledModules: readonly string[] | null,
): boolean {
  if (!enabledModules) return true;
  const mod = moduleIdForTenantNavPath(pathname);
  if (!mod) return true;
  return hasFeature(enabledModules, mod);
}
