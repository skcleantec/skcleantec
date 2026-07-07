/** 랜딩·외부 페이지 문의 폼 — 커스텀 필드 정의 (브랜드별 JSON) */

export type LandingContactFieldType = 'text' | 'textarea' | 'tel' | 'email' | 'number';

export type LandingContactCustomFieldDef = {
  key: string;
  label: string;
  type: LandingContactFieldType;
  required?: boolean;
  placeholder?: string;
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

export const LANDING_CONTACT_INQUIRY_STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'] as const;
export type LandingContactInquiryStatus = (typeof LANDING_CONTACT_INQUIRY_STATUSES)[number];

export const LANDING_CONTACT_STATUS_LABELS: Record<LandingContactInquiryStatus, string> = {
  NEW: '신규',
  CONTACTED: '연락함',
  CONVERTED: '접수전환',
  CLOSED: '종료',
};
