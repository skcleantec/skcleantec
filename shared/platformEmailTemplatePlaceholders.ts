import type { CustomerOutboundEmailPurpose } from './outboundEmailPurpose.js';

export type PlatformEmailTemplatePlaceholder = {
  key: string;
  label: string;
  sample: string;
};

export const PLATFORM_EMAIL_SUBJECT_PLACEHOLDERS: PlatformEmailTemplatePlaceholder[] = [
  { key: 'customerName', label: '고객명', sample: '홍길동' },
  { key: 'brandDisplayName', label: '업체/브랜드명', sample: '○○청소' },
  { key: 'inquiryNumber', label: '접수번호', sample: 'SK2603110001' },
];

export const PLATFORM_EMAIL_BODY_PLACEHOLDERS: Record<
  CustomerOutboundEmailPurpose,
  PlatformEmailTemplatePlaceholder[]
> = {
  ORDER_FORM_SUBMISSION: [
    ...PLATFORM_EMAIL_SUBJECT_PLACEHOLDERS,
    {
      key: 'detailSections',
      label: '접수 상세(자동)',
      sample: '(발송 시 접수 내용 표가 삽입됩니다)',
    },
  ],
  INSPECTION_COMPLETION: [
    ...PLATFORM_EMAIL_SUBJECT_PLACEHOLDERS,
    { key: 'serviceDate', label: '서비스일', sample: '2026-03-15' },
    { key: 'address', label: '주소', sample: '서울시 …' },
    { key: 'teamLeaderName', label: '담당 팀장', sample: '김팀장' },
    {
      key: 'inspectionBody',
      label: '검수 본문(자동)',
      sample: '(발송 시 검수 표·사진 링크가 삽입됩니다)',
    },
  ],
};

export function applyPlatformEmailTemplatePlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return out;
}
