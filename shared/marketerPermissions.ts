import type { MarketerAdminLevel } from './marketerAdminLevel.js';

/** 마케터 세부 권한 ID — 단일 소스 */
export type MarketerPermissionId =
  | 'inquiry.view'
  | 'inquiry.create'
  | 'inquiry.edit.basic'
  | 'inquiry.edit.marketer'
  | 'inquiry.edit.assignment'
  | 'inquiry.delete'
  | 'inquiry.bulkDelete'
  | 'inquiry.excelImport'
  | 'inquiry.changeLog.view'
  | 'schedule.edit.inquiry'
  | 'schedule.closures'
  | 'schedule.dayAvailability'
  | 'schedule.customCalendar'
  | 'schedule.staffMemo'
  | 'orderform.issue'
  | 'orderform.edit'
  | 'orderform.templates'
  | 'orderform.formConfig'
  | 'quotation.create'
  | 'quotation.config'
  | 'cs.view'
  | 'cs.edit'
  | 'cs.delete'
  | 'leads.view'
  | 'leads.edit'
  | 'followup.view'
  | 'followup.edit'
  | 'ads.sessions'
  | 'ads.analytics'
  | 'ads.settings'
  | 'messages.send'
  | 'marketplace.view'
  | 'marketplace.trade'
  | 'admin.users'
  | 'admin.payroll'
  | 'admin.externalSettlement'
  | 'admin.companyProfile'
  | 'admin.pageSettings'
  | 'admin.eContract'
  | 'admin.inspectionTemplate'
  | 'admin.tenantPartners'
  | 'admin.serviceZones'
  | 'staff.permissions.view'
  | 'crm.view'
  | 'crm.settings';

export type MarketerPermissionMap = Record<MarketerPermissionId, boolean>;

export type MarketerPermissionMeta = {
  id: MarketerPermissionId;
  label: string;
  description: string;
  /** ADMIN·업체 소유자 전용 — 마케터 UI에서 체크 불가 */
  adminLocked?: boolean;
  /** TenantFeature moduleId — off면 UI 회색 처리 */
  featureModuleId?: string;
};

export type MarketerPermissionGroup = {
  id: string;
  label: string;
  permissions: MarketerPermissionMeta[];
};

export const MARKETER_PERMISSION_GROUPS: MarketerPermissionGroup[] = [
  {
    id: 'inquiry',
    label: '접수·배정',
    permissions: [
      { id: 'inquiry.view', label: '접수 조회', description: '접수 목록·상세·스케줄에서 접수 확인' },
      { id: 'inquiry.create', label: '접수·발주 등록', description: '신규 접수·발주서 발급' },
      { id: 'inquiry.edit.basic', label: '접수 일반 수정', description: '고객 정보·일정·상태 등 기본 필드 수정' },
      {
        id: 'inquiry.edit.marketer',
        label: '담당 마케터 변경',
        description: '접수 등록자(마케터) 변경',
      },
      {
        id: 'inquiry.edit.assignment',
        label: '팀장·타업체 배정',
        description: '담당 팀장·타업체 분배 변경',
      },
      { id: 'inquiry.delete', label: '접수 삭제', description: '단건 접수 삭제(비밀번호 확인)' },
      { id: 'inquiry.bulkDelete', label: '접수 일괄 삭제', description: '선택 접수 일괄 삭제' },
      { id: 'inquiry.excelImport', label: '접수 엑셀 일괄 등록', description: '엑셀 파일로 접수 일괄 등록' },
      { id: 'inquiry.changeLog.view', label: '접수 변경 이력 조회', description: '접수 수정 이력 목록' },
    ],
  },
  {
    id: 'schedule',
    label: '스케줄',
    permissions: [
      { id: 'schedule.edit.inquiry', label: '스케줄에서 접수 수정', description: '관리 스케줄 상세에서 접수 편집' },
      { id: 'schedule.closures', label: '일정 마감', description: '스케줄 일자 마감·해제' },
      { id: 'schedule.dayAvailability', label: '일별 가용 조정', description: '팀장 TO·가용 인원 조정' },
      { id: 'schedule.customCalendar', label: '지역 필터 캘린더', description: '맞춤 지역 캘린더 생성·수정' },
      { id: 'schedule.staffMemo', label: '당일 공유 메모', description: '스케줄 당일 메모 작성' },
    ],
  },
  {
    id: 'orderform',
    label: '발주·견적',
    permissions: [
      { id: 'orderform.issue', label: '발주서 발급', description: '고객용 발주 링크 발급' },
      { id: 'orderform.edit', label: '발주서 수정', description: '발급된 발주서 내용 수정' },
      { id: 'orderform.templates', label: '발주서 템플릿', description: '발주서 템플릿 관리' },
      { id: 'orderform.formConfig', label: '발주 안내·폼 설정', description: '발주 페이지 안내·필드 설정' },
      { id: 'quotation.create', label: '견적 작성·발송', description: '견적서 작성 및 이메일 발송' },
      { id: 'quotation.config', label: '견적 설정', description: '견적 항목·기본값 설정' },
    ],
  },
  {
    id: 'cs',
    label: 'C/S·부재',
    permissions: [
      { id: 'cs.view', label: 'C/S 조회', description: 'C/S 접수 목록·상세' },
      { id: 'cs.edit', label: 'C/S 처리', description: 'C/S 상태·메모 수정' },
      { id: 'cs.delete', label: 'C/S 삭제', description: 'C/S 접수 삭제' },
      { id: 'followup.view', label: '부재·보류 조회', description: '부재·보류 목록' },
      { id: 'followup.edit', label: '부재·보류 처리', description: '부재·보류 상태 변경' },
      {
        id: 'leads.view',
        label: '문의내역 조회',
        description: '랜딩·외부 페이지 문의 목록·상세',
        featureModuleId: 'mod_landing_inquiry',
      },
      {
        id: 'leads.edit',
        label: '문의내역 처리',
        description: '문의 상태 변경·접수 전환·폼 설정',
        featureModuleId: 'mod_landing_inquiry',
      },
    ],
  },
  {
    id: 'telecrm',
    label: '텔레CRM',
    permissions: [
      {
        id: 'crm.view',
        label: '텔레CRM 사용',
        description: '텔레CRM 작업 화면·스크립트·가격 조회',
        featureModuleId: 'mod_telecrm',
      },
      {
        id: 'crm.settings',
        label: '텔레CRM 설정',
        description: '스크립트·가격 카테고리 등록·수정·삭제',
        featureModuleId: 'mod_telecrm',
      },
    ],
  },
  {
    id: 'ads',
    label: '광고비',
    permissions: [
      { id: 'ads.sessions', label: '광고 세션 입력', description: '일별 광고 작업 세션 등록' },
      { id: 'ads.analytics', label: '광고 집계·리포트', description: '광고비 집계·분석 화면' },
      { id: 'ads.settings', label: '광고 채널·설정', description: '광고 채널·정산 설정(소유자 전용 일부 제외)' },
    ],
  },
  {
    id: 'messages',
    label: '메시지',
    permissions: [{ id: 'messages.send', label: '메시지 발송', description: '팀장·직원에게 메시지 발송' }],
  },
  {
    id: 'marketplace',
    label: '정보공유(DB 마켓)',
    permissions: [
      {
        id: 'marketplace.view',
        label: '목록 조회',
        description: '정보공유 목록·상세 조회',
        featureModuleId: 'mod_tenant_exchange',
      },
      {
        id: 'marketplace.trade',
        label: '등록·구매·확정',
        description: 'DB 등록·구매 요청·거래 확정',
        featureModuleId: 'mod_tenant_exchange',
      },
    ],
  },
  {
    id: 'admin',
    label: '관리자 전용 메뉴',
    permissions: [
      { id: 'admin.users', label: '사용자·팀장·팀원', description: '사용자 등록·수정·팀원 관리' },
      { id: 'admin.payroll', label: '급여·정산표', description: '급여표·정산 관리' },
      { id: 'admin.externalSettlement', label: '타업체·파트너 정산', description: '타업체·파트너 정산 화면' },
      { id: 'admin.companyProfile', label: '업체 등록정보', description: '사업자·업체 프로필 설정' },
      { id: 'admin.pageSettings', label: '고객 페이지·브랜딩', description: '공개 페이지·브랜딩 설정' },
      { id: 'admin.eContract', label: '전자계약', description: '전자계약 관리', featureModuleId: 'mod_e_contract' },
      { id: 'admin.inspectionTemplate', label: '검수 템플릿', description: '현장 검수 체크리스트 템플릿' },
      {
        id: 'admin.tenantPartners',
        label: '파트너 연결',
        description: '타 테넌트 파트너 연결',
        featureModuleId: 'mod_tenant_exchange',
      },
      { id: 'admin.serviceZones', label: '서비스 권역', description: '서비스 권역 설정' },
      {
        id: 'staff.permissions.view',
        label: '직원 권한 설정(조회)',
        description: '직원 권한 화면 열람 — 변경은 ADMIN만',
      },
    ],
  },
];

export const MARKETER_PERMISSION_IDS: MarketerPermissionId[] = MARKETER_PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.id),
);

/** 마케터에게 부여 불가(항상 false) */
export const MARKETER_ADMIN_LOCKED_PERMISSION_IDS: MarketerPermissionId[] = ['staff.permissions.view'];

export const OPERATIONAL_MARKETER_PERMISSION_IDS: MarketerPermissionId[] = [
  'inquiry.edit.marketer',
  'inquiry.edit.assignment',
  'inquiry.delete',
  'inquiry.bulkDelete',
  'inquiry.excelImport',
  'inquiry.changeLog.view',
  'schedule.staffMemo',
];

export const ADMIN_MENU_MARKETER_PERMISSION_IDS: MarketerPermissionId[] = MARKETER_PERMISSION_IDS.filter(
  (id) => id.startsWith('admin.') || id === 'staff.permissions.view',
);

const NONE_PRESET: MarketerPermissionId[] = [
  'inquiry.view',
  'inquiry.create',
  'inquiry.edit.basic',
  'schedule.edit.inquiry',
  'orderform.issue',
  'orderform.edit',
  'quotation.create',
  'cs.view',
  'cs.edit',
  'followup.view',
  'followup.edit',
  'ads.sessions',
  'ads.analytics',
  'messages.send',
  'marketplace.view',
  'marketplace.trade',
  'crm.view',
];

const LIMITED_EXTRA: MarketerPermissionId[] = [
  'inquiry.edit.marketer',
  'inquiry.edit.assignment',
  'inquiry.delete',
  'inquiry.bulkDelete',
  'inquiry.excelImport',
  'inquiry.changeLog.view',
  'schedule.staffMemo',
];

const FULL_EXTRA: MarketerPermissionId[] = [
  'schedule.closures',
  'schedule.dayAvailability',
  'schedule.customCalendar',
  'orderform.templates',
  'orderform.formConfig',
  'quotation.config',
  'cs.delete',
  'ads.settings',
  'admin.users',
  'admin.payroll',
  'admin.externalSettlement',
  'admin.companyProfile',
  'admin.pageSettings',
  'admin.eContract',
  'admin.inspectionTemplate',
  'admin.tenantPartners',
  'admin.serviceZones',
  'crm.settings',
];

function emptyPermissionMap(): MarketerPermissionMap {
  return Object.fromEntries(MARKETER_PERMISSION_IDS.map((id) => [id, false])) as MarketerPermissionMap;
}

export function buildMarketerPresetPermissions(level: MarketerAdminLevel): MarketerPermissionMap {
  const map = emptyPermissionMap();
  const grant = (ids: MarketerPermissionId[]) => {
    for (const id of ids) map[id] = true;
  };
  grant(NONE_PRESET);
  if (level === 'LIMITED' || level === 'FULL') grant(LIMITED_EXTRA);
  if (level === 'FULL') grant(FULL_EXTRA);
  for (const id of MARKETER_ADMIN_LOCKED_PERMISSION_IDS) map[id] = false;
  return map;
}

export function isMarketerPermissionId(raw: unknown): raw is MarketerPermissionId {
  return typeof raw === 'string' && MARKETER_PERMISSION_IDS.includes(raw as MarketerPermissionId);
}

/** DB JSON → 부분 맵 (알 수 없는 키 무시) */
export function parseMarketerPermissionsJson(raw: unknown): Partial<MarketerPermissionMap> | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Partial<MarketerPermissionMap> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (isMarketerPermissionId(key) && typeof val === 'boolean') out[key] = val;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** custom null → 프리셋만, custom 있으면 프리셋 위에 덮어씀 */
export function resolveMarketerPermissionMap(
  level: MarketerAdminLevel,
  custom: Partial<MarketerPermissionMap> | null | undefined,
): MarketerPermissionMap {
  const base = buildMarketerPresetPermissions(level);
  if (!custom) return base;
  const merged = { ...base, ...custom };
  for (const id of MARKETER_ADMIN_LOCKED_PERMISSION_IDS) merged[id] = false;
  return merged;
}

export function permissionsMatchPreset(map: MarketerPermissionMap, level: MarketerAdminLevel): boolean {
  const preset = buildMarketerPresetPermissions(level);
  return MARKETER_PERMISSION_IDS.every((id) => map[id] === preset[id]);
}

export function hasMarketerPermission(
  role: string | null | undefined,
  map: MarketerPermissionMap,
  permissionId: MarketerPermissionId,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MARKETER') return false;
  return Boolean(map[permissionId]);
}

export function hasMarketerAdminMenuAccessFromMap(
  role: string | null | undefined,
  map: MarketerPermissionMap,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MARKETER') return false;
  return ADMIN_MENU_MARKETER_PERMISSION_IDS.some((id) => map[id]);
}

export function hasMarketerOperationalAccessFromMap(
  role: string | null | undefined,
  map: MarketerPermissionMap,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MARKETER') return false;
  return OPERATIONAL_MARKETER_PERMISSION_IDS.some((id) => map[id]);
}

/** 저장용 — 잠금 권한 제거·불리언만 */
export function sanitizeMarketerPermissionsForSave(
  input: Partial<MarketerPermissionMap>,
): Partial<MarketerPermissionMap> {
  const out: Partial<MarketerPermissionMap> = {};
  for (const id of MARKETER_PERMISSION_IDS) {
    if (MARKETER_ADMIN_LOCKED_PERMISSION_IDS.includes(id)) continue;
    if (typeof input[id] === 'boolean') out[id] = input[id];
  }
  return out;
}

export function buildFullMarketerPermissionsForSave(map: MarketerPermissionMap): MarketerPermissionMap {
  const out = { ...map };
  for (const id of MARKETER_ADMIN_LOCKED_PERMISSION_IDS) out[id] = false;
  return out;
}
