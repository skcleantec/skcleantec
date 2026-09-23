/** 랜딩·외부 페이지 문의 폼 — 커스텀 필드 정의 (브랜드별 JSON) */

export type LandingContactFieldType = 'text' | 'textarea' | 'tel' | 'email' | 'number' | 'select';

/** 고르기 선택지. 하위는 한 단계만. */
export type LandingContactChoiceOption = {
  label: string;
  children?: { label: string }[];
};

export type LandingContactCustomFieldDef = {
  key: string;
  label: string;
  type: LandingContactFieldType;
  required?: boolean;
  placeholder?: string;
  /** type === 'select' 일 때 선택지. 예전 저장분은 문자열 배열도 읽는다. */
  options?: LandingContactChoiceOption[];
};

export const LANDING_CONTACT_CHOICE_SEP = ' · ';

export const LANDING_CONTACT_FIELD_TYPE_LABELS: Record<LandingContactFieldType, string> = {
  text: '한 줄',
  textarea: '여러 줄',
  number: '숫자',
  select: '고르기',
  tel: '전화번호',
  email: '이메일',
};

/** 새로 추가할 때 고르는 유형. 전화번호·이메일은 이미 저장된 항목만 유지 */
export const LANDING_CONTACT_EDITOR_FIELD_TYPES: LandingContactFieldType[] = [
  'text',
  'number',
  'textarea',
  'select',
];

export function newLandingContactFieldKey(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let key = 'f_';
  for (let i = 0; i < 8; i += 1) {
    key += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return key;
}

export function joinLandingContactChoice(parent: string, child?: string): string {
  const p = parent.trim();
  const c = child?.trim() ?? '';
  if (!c) return p;
  return `${p}${LANDING_CONTACT_CHOICE_SEP}${c}`;
}

export function splitLandingContactChoice(
  value: string,
  options: LandingContactChoiceOption[],
): { parent: string; child: string } {
  const raw = value.trim();
  for (const opt of options) {
    if (raw === opt.label) return { parent: opt.label, child: '' };
    for (const child of opt.children ?? []) {
      if (raw === joinLandingContactChoice(opt.label, child.label)) {
        return { parent: opt.label, child: child.label };
      }
    }
  }
  return { parent: '', child: '' };
}

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
    options: LANDING_CONTACT_PROPERTY_TYPE_OPTIONS.map((label) => ({ label })),
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

/** 공개 문의 폼 헤더·브라우저 탭 — 설정 제목만 사용, 없으면 「문의하기」 */
export function resolveLandingContactPublicTitle(title: string | null | undefined): string {
  const t = title?.trim();
  return t || '문의하기';
}
