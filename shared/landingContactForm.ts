/** 랜딩·외부 페이지 문의 폼 — 커스텀 필드 정의 (브랜드별 JSON) */

export type LandingContactFieldType = 'text' | 'textarea' | 'tel' | 'email' | 'number' | 'select';

export type LandingContactCustomFieldDef = {
  key: string;
  label: string;
  type: LandingContactFieldType;
  required?: boolean;
  placeholder?: string;
  /** type === 'select' 일 때 선택지 */
  options?: string[];
};

export type LandingContactFormConfigDto = {
  operatingCompanyId: string;
  operatingCompanyName: string;
  operatingCompanySlug: string;
  displayName: string;
  title: string | null;
  introText: string | null;
  customFields: LandingContactCustomFieldDef[];
  isActive: boolean;
};

/** 발주서·접수와 동일한 주거형태(건축물 유형) */
export const LANDING_CONTACT_PROPERTY_TYPE_OPTIONS = [
  '아파트',
  '오피스텔',
  '빌라(연립)',
  '상가',
  '기타',
] as const;

/** 신규 브랜드 문의 폼 기본 추가 항목 (성함·연락처·문의 내용은 고정) */
export const DEFAULT_LANDING_CONTACT_CUSTOM_FIELDS: LandingContactCustomFieldDef[] = [
  {
    key: 'area_pyeong',
    label: '평수',
    type: 'number',
    required: true,
    placeholder: '예: 33',
  },
  {
    key: 'property_type',
    label: '건축물 유형',
    type: 'select',
    required: true,
    options: [...LANDING_CONTACT_PROPERTY_TYPE_OPTIONS],
  },
];

export const LANDING_CONTACT_INQUIRY_STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'] as const;
export type LandingContactInquiryStatus = (typeof LANDING_CONTACT_INQUIRY_STATUSES)[number];

export const LANDING_CONTACT_STATUS_LABELS: Record<LandingContactInquiryStatus, string> = {
  NEW: '신규',
  CONTACTED: '연락함',
  CONVERTED: '접수전환',
  CLOSED: '종료',
};
