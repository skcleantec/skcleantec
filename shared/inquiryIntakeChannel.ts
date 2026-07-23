/** @sync server/src/modules/inquiry-lead-sources/inquiryLeadSource.service.ts INQUIRY_INTAKE_CHANNEL_LABELS */

/** 접수가 들어온 업무 경로 — Inquiry.intakeChannel */
export const INQUIRY_INTAKE_CHANNEL_LABELS = {
  telecrm: '텔레CRM',
  order_issue: '발주서 발급',
  order_form_submit: '고객 발주서 제출',
  schedule: '스케줄 접수',
  phone: '전화 접수',
  manual: '수기등록',
} as const;

export type InquiryIntakeChannelId = keyof typeof INQUIRY_INTAKE_CHANNEL_LABELS;

const LEGACY_CHANNEL_SOURCES = new Set(['발주서', '전화']);

/** 예전에 source 컬럼에 저장되던 「채널」 값 — 유입 플랫폼 표시에서 제외 */
export function isLegacyInquiryChannelSource(source: string | null | undefined): boolean {
  const s = (source ?? '').trim();
  if (!s) return false;
  if (LEGACY_CHANNEL_SOURCES.has(s)) return true;
  if (s.includes('수기등록') || s.includes('외부업체')) return true;
  return false;
}

/** 목록·요약용 — 숨고·미소 등 플랫폼만. 발주서·전화 등 레거시 채널 값은 — */
export function formatInquiryLeadPlatformLabel(source: string | null | undefined): string {
  const s = (source ?? '').trim();
  if (!s || s === '시드' || isLegacyInquiryChannelSource(s)) return '—';
  return s;
}

export type InquiryIntakeChannelLegacyHint = {
  source?: string | null;
  orderFormSubmitted?: boolean;
};

/** 상세용 — 텔레CRM·발주서 발급 등 접수 경로 */
export function formatInquiryIntakeChannelLabel(
  intakeChannel: string | null | undefined,
  legacy?: InquiryIntakeChannelLegacyHint,
): string {
  const ch = (intakeChannel ?? '').trim() as InquiryIntakeChannelId;
  if (ch && ch in INQUIRY_INTAKE_CHANNEL_LABELS) {
    return INQUIRY_INTAKE_CHANNEL_LABELS[ch];
  }
  const source = (legacy?.source ?? '').trim();
  if (source === '발주서') {
    return legacy?.orderFormSubmitted ? '고객 발주서 제출' : '발주서 발급';
  }
  if (source === '전화') return '전화 접수';
  if (source.includes('수기등록') || source.includes('외부업체')) return '수기등록';
  return '—';
}

export function shouldShowInquiryLeadPlatform(source: string | null | undefined): boolean {
  return formatInquiryLeadPlatformLabel(source) !== '—';
}
