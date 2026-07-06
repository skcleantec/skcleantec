/**
 * @generated-sync from shared/telecrmConsultationQuote.ts — 직접 수정하지 마세요.
 * 변경: shared/telecrmConsultationQuote.ts 수정 후 `npm run sync:telecrm-consultation-quote`.
 */

export type TelecrmQuoteLineSource = 'telecrm' | 'order';

export type TelecrmConsultationQuoteLine = {
  source: TelecrmQuoteLineSource;
  label: string;
  sublabel?: string;
  itemId?: string;
  optionId?: string;
  catalogAmountWon: number | null;
  amountWon: number | null;
  priceHint?: string | null;
  quantity?: number;
};

export type TelecrmConsultationQuotePayload = {
  pyeong: string;
  baseEstimateWon: number | null;
  minimumApplied?: boolean;
  lines: TelecrmConsultationQuoteLine[];
  grandTotalWon: number | null;
  copyText: string;
};

export type TelecrmConsultationQuoteStatus = 'DRAFT' | 'QUOTED' | 'ORDER_ISSUED' | 'SUPERSEDED';

/** 발주서 커스텀 필드 — CRM 견적 항목별 내역 prefill */
export const TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY = 'crmQuoteBreakdown' as const;

export const TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_META = {
  fieldKey: TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY,
  label: '견적 내역 (상담)',
  helpText: '텔레CRM 상담 견적 항목·합계가 자동으로 채워집니다.',
  inputType: 'TEXTAREA' as const,
  placeholder: null as string | null,
  required: false,
  fillMode: 'CUSTOMER' as const,
};

export function formatTelecrmQuoteWon(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function buildTelecrmQuoteCopyText(input: {
  pyeong: string;
  baseEstimateWon: number | null;
  lines: TelecrmConsultationQuoteLine[];
  grandTotalWon: number | null;
}): string {
  const rows: string[] = [];
  const pyeongNum = parseFloat(String(input.pyeong).replace(/,/g, ''));
  if (input.baseEstimateWon != null && Number.isFinite(pyeongNum) && pyeongNum > 0) {
    rows.push(`${pyeongNum}평 기본견적 ${formatTelecrmQuoteWon(input.baseEstimateWon)}`);
  }
  for (const line of input.lines) {
    const pricePart =
      line.amountWon != null
        ? formatTelecrmQuoteWon(line.amountWon)
        : line.priceHint?.trim() || '—';
    const prefix = line.sublabel ?? line.label;
    rows.push(`+ ${prefix} ${pricePart}`);
  }
  if (input.grandTotalWon != null) {
    rows.push(`합계 ${formatTelecrmQuoteWon(input.grandTotalWon)}`);
  }
  return rows.join('\n');
}

export function telecrmQuotePayloadHasContent(payload: TelecrmConsultationQuotePayload): boolean {
  return Boolean(
    payload.pyeong.trim() ||
      payload.lines.length > 0 ||
      payload.baseEstimateWon != null ||
      (payload.grandTotalWon != null && payload.grandTotalWon > 0),
  );
}

function formatTelecrmQuoteMemoWhen(at: Date): string {
  return at.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** 부재/보류 followup.memo 자동 기록용 */
export function buildTelecrmQuoteFollowupMemo(input: {
  payload: TelecrmConsultationQuotePayload;
  actorName?: string | null;
  at?: Date;
  footer?: string;
}): string {
  const at = input.at ?? new Date();
  const actor = input.actorName?.trim() || '마케터';
  const rows: string[] = [`[텔레CRM 견적 ${formatTelecrmQuoteMemoWhen(at)} · ${actor}]`];
  const pyeongNum = parseFloat(String(input.payload.pyeong).replace(/,/g, ''));
  if (input.payload.baseEstimateWon != null && Number.isFinite(pyeongNum) && pyeongNum > 0) {
    rows.push(`${pyeongNum}평 기본 ${formatTelecrmQuoteWon(input.payload.baseEstimateWon)}`);
  }
  for (const line of input.payload.lines) {
    const prefix = line.sublabel ?? line.label;
    const pricePart =
      line.amountWon != null
        ? formatTelecrmQuoteWon(line.amountWon)
        : line.priceHint?.trim() || '—';
    rows.push(`+ ${prefix} ${pricePart}`);
  }
  if (input.payload.grandTotalWon != null) {
    rows.push(`합계 ${formatTelecrmQuoteWon(input.payload.grandTotalWon)}`);
  }
  rows.push(input.footer?.trim() || '(고객 생각해봄)');
  return rows.join('\n');
}
