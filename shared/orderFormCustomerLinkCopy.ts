/** 고객 발주서 링크 안내 메시지 — 링크 URL 제외 편집 가능 문구 기본값 */
export const ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS = {
  customerLinkTotalLine: '총 금액 {{amount}}원 {{priceLabel}}',
  customerLinkBalanceLine: '잔금 {{balance}}원, 예약금 {{deposit}}원',
  customerLinkScheduleLine: '청소일시: {{date}} ({{timeSlot}})',
  customerLinkTimeDetailLine: '희망 시각: {{timeDetail}}',
  customerLinkOrderIntro: '아래 링크에서 예약확정서를 작성해 주세요.',
  customerLinkCsNotice:
    '청소 후 청소팀 태도, 고객 불편 관련 신고는 본사에 직접 요청해주시면 바로 시정처리 해드리겠습니다.',
  customerLinkCsUrlLabel: '신고 URL:',
  customerLinkPaybackBlock: `★ 리뷰 페이백 신청 (전화·카톡 확인 없이 링크에서만 접수됩니다)
리뷰 작성 후 반드시 아래 링크에 접속해 캡처·계좌를 등록해 주세요.
전화나 메시지로 보내주시면 확인이 지연될 수 있습니다.

페이백 신청: {{paybackLink}}`,
} as const;

export type CustomerLinkCopyFieldKey = keyof typeof ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS;

export type CustomerLinkCopyConfig = Record<CustomerLinkCopyFieldKey, string>;

export type CustomerLinkCopyConfigInput = Partial<Record<CustomerLinkCopyFieldKey, string | null>>;

function line(raw: string | null | undefined, fallback: string): string {
  const t = raw != null ? String(raw).trim() : '';
  return t || fallback;
}

/** DB/API 값 → 메시지 빌드용(빈 값은 기본 문구) */
export function resolveCustomerLinkCopy(input: CustomerLinkCopyConfigInput | null | undefined): CustomerLinkCopyConfig {
  const d = ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS;
  return {
    customerLinkTotalLine: line(input?.customerLinkTotalLine, d.customerLinkTotalLine),
    customerLinkBalanceLine: line(input?.customerLinkBalanceLine, d.customerLinkBalanceLine),
    customerLinkScheduleLine: line(input?.customerLinkScheduleLine, d.customerLinkScheduleLine),
    customerLinkTimeDetailLine: line(input?.customerLinkTimeDetailLine, d.customerLinkTimeDetailLine),
    customerLinkOrderIntro: line(input?.customerLinkOrderIntro, d.customerLinkOrderIntro),
    customerLinkCsNotice: line(input?.customerLinkCsNotice, d.customerLinkCsNotice),
    customerLinkCsUrlLabel: line(input?.customerLinkCsUrlLabel, d.customerLinkCsUrlLabel),
    customerLinkPaybackBlock: line(input?.customerLinkPaybackBlock, d.customerLinkPaybackBlock),
  };
}

/** `{{amount}}` 등 치환 — 링크 URL은 호출부에서 vars 로 전달 */
export function applyCustomerLinkTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

/** 치환 후 빈 줄·빈 라벨 줄 정리 */
export function finalizeCustomerLinkMessage(text: string): string {
  const withoutHollow = text
    .split('\n')
    .filter((raw) => {
      const t = raw.trim();
      if (!t) return true;
      // "청소일시: " / "희망 시각: ()" 처럼 값만 비어 라벨만 남은 줄
      if (/^.+:\s*(\(\s*\))?\s*$/.test(t)) return false;
      return true;
    })
    .join('\n');

  return withoutHollow
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 자유 편집용 기본 본문.
 * 문장(라벨)은 일반 글자로 두고, 값만 {{date}}·{{amount}} 등으로 둔다.
 * → 「청소일시」를 「실제청소일시」로 고치는 식의 수정이 가능.
 */
export function buildDefaultCustomerLinkMessageTemplate(input?: {
  formTitle?: string | null;
  customerLinkTotalLine?: string | null;
  customerLinkBalanceLine?: string | null;
  reviewEventText?: string | null;
  customerLinkScheduleLine?: string | null;
  customerLinkTimeDetailLine?: string | null;
  customerLinkOrderIntro?: string | null;
  customerLinkCsNotice?: string | null;
  customerLinkCsUrlLabel?: string | null;
  customerLinkPaybackBlock?: string | null;
  footerNotice1?: string | null;
  footerNotice2?: string | null;
}): string {
  const copy = resolveCustomerLinkCopy(input);
  const review =
    input?.reviewEventText != null && String(input.reviewEventText).trim() !== ''
      ? String(input.reviewEventText).trim()
      : '* 리뷰 별5점 이벤트 참여, 1만원 입금';
  const footer1 =
    (input?.footerNotice1 != null && String(input.footerNotice1).trim()) ||
    '‼️ 청소 전일 저녁, 담당 팀장 연락 드림';
  const footer2 =
    (input?.footerNotice2 != null && String(input.footerNotice2).trim()) ||
    '❌ 연락 없을 시, 본사 확인 요청 필수';

  const paybackExpanded = copy.customerLinkPaybackBlock.includes('{{paybackLink}}')
    ? copy.customerLinkPaybackBlock
    : `${copy.customerLinkPaybackBlock}\n\n페이백 신청: {{paybackLink}}`;

  // 일정·시각 줄: 조각 템플릿이 이미 {{date}} 등이면 그대로, 아니면 기본 라벨+원자 토큰
  const scheduleTpl = /{{\s*date\s*}}/i.test(copy.customerLinkScheduleLine)
    ? copy.customerLinkScheduleLine
    : '청소일시: {{date}} ({{timeSlot}})';
  const timeDetailTpl = /{{\s*timeDetail\s*}}/i.test(copy.customerLinkTimeDetailLine)
    ? copy.customerLinkTimeDetailLine
    : '희망 시각: {{timeDetail}}';

  return [
    '{{brandName}} 발주서',
    '',
    copy.customerLinkTotalLine,
    copy.customerLinkBalanceLine,
    review,
    '',
    scheduleTpl,
    timeDetailTpl,
    '{{optionNote}}',
    '',
    copy.customerLinkOrderIntro,
    '{{orderLink}}',
    '',
    copy.customerLinkCsNotice,
    `${copy.customerLinkCsUrlLabel} {{csLink}}`,
    '',
    paybackExpanded,
    '',
    footer1,
    footer2,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
