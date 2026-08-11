/**
 * @generated-sync from shared/outboundEmailPurpose.ts — 직접 수정하지 마세요.
 * 변경: shared/outboundEmailPurpose.ts 수정 후 `npm run sync:outbound-email-purpose` (prebuild/predev 자동).
 */

export const OUTBOUND_EMAIL_PURPOSES = [
  'ORDER_FORM_SUBMISSION',
  'INSPECTION_COMPLETION',
] as const;

export type OutboundEmailPurpose = (typeof OUTBOUND_EMAIL_PURPOSES)[number];

/** 테넌트 SMTP 유지 (견적서·영수증 등) — 플랫폼 프로필 목록에는 넣지 않음 */
export const TENANT_SMTP_PURPOSES = ['QUOTATION'] as const;

export type TenantSmtpPurpose = (typeof TENANT_SMTP_PURPOSES)[number];

export const OUTBOUND_EMAIL_PURPOSE_LABELS: Record<OutboundEmailPurpose, string> = {
  ORDER_FORM_SUBMISSION: '발주서 제출 확인 (고객)',
  INSPECTION_COMPLETION: '현장검수 완료본 (고객)',
};

export function isOutboundEmailPurpose(raw: unknown): raw is OutboundEmailPurpose {
  return (
    typeof raw === 'string' &&
    (OUTBOUND_EMAIL_PURPOSES as readonly string[]).includes(raw)
  );
}

export function parseOutboundEmailPurposes(raw: unknown): OutboundEmailPurpose[] {
  if (!Array.isArray(raw)) return [];
  const out: OutboundEmailPurpose[] = [];
  for (const item of raw) {
    if (isOutboundEmailPurpose(item) && !out.includes(item)) out.push(item);
  }
  return out;
}
