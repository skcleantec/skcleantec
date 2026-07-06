import { computeEstimateTotalFromPyeong } from '@shared/estimateTotal';
import {
  buildTelecrmQuoteCopyText,
  type TelecrmConsultationQuoteLine,
  type TelecrmConsultationQuotePayload,
} from '@shared/telecrmConsultationQuote';

export type CrmPricingQuoteLine = {
  key: string;
  label: string;
  sublabel?: string;
  source: 'telecrm' | 'order';
  catalogAmountWon: number | null;
  amountWon: number | null;
  priceHint?: string | null;
  itemId?: string;
  optionId?: string;
};

export function crmQuoteLinesFromPayload(payload: TelecrmConsultationQuotePayload): CrmPricingQuoteLine[] {
  return payload.lines.map((line, i) => ({
    key: `${line.source}:${line.optionId ?? line.itemId ?? line.label}:${i}:${Date.now()}`,
    label: line.label,
    sublabel: line.sublabel,
    source: line.source,
    catalogAmountWon: line.catalogAmountWon,
    amountWon: line.amountWon,
    priceHint: line.priceHint,
    itemId: line.itemId,
    optionId: line.optionId,
  }));
}

export function crmQuotePayloadFromState(input: {
  pyeong: string;
  pricePerPyeong: number;
  minimumTotalAmount: number;
  quoteLines: CrmPricingQuoteLine[];
}): TelecrmConsultationQuotePayload {
  const pyeongNum = parseFloat(input.pyeong.replace(/,/g, ''));
  const baseEstimateWon =
    Number.isFinite(pyeongNum) && pyeongNum > 0 && input.pricePerPyeong > 0
      ? computeEstimateTotalFromPyeong(pyeongNum, input.pricePerPyeong, input.minimumTotalAmount)
      : null;
  const rawBase =
    Number.isFinite(pyeongNum) && pyeongNum > 0 && input.pricePerPyeong > 0
      ? Math.round(pyeongNum * input.pricePerPyeong)
      : null;
  const minimumApplied =
    input.minimumTotalAmount > 0 &&
    baseEstimateWon != null &&
    rawBase != null &&
    baseEstimateWon > rawBase;

  const lines: TelecrmConsultationQuoteLine[] = input.quoteLines.map((line) => ({
    source: line.source,
    label: line.label,
    sublabel: line.sublabel,
    itemId: line.itemId,
    optionId: line.optionId,
    catalogAmountWon: line.catalogAmountWon,
    amountWon: line.amountWon,
    priceHint: line.priceHint,
  }));

  const extrasTotal = input.quoteLines.reduce((sum, line) => sum + (line.amountWon ?? 0), 0);
  const grandTotalWon =
    baseEstimateWon != null ? baseEstimateWon + extrasTotal : extrasTotal > 0 ? extrasTotal : null;

  const payload: TelecrmConsultationQuotePayload = {
    pyeong: input.pyeong,
    baseEstimateWon,
    minimumApplied: minimumApplied || undefined,
    lines,
    grandTotalWon,
    copyText: '',
  };
  payload.copyText = buildTelecrmQuoteCopyText(payload);
  return payload;
}

export function crmQuoteGrandTotalWon(payload: TelecrmConsultationQuotePayload): number | null {
  return payload.grandTotalWon;
}

export function crmQuoteProfessionalOptionIdsFromLines(
  lines: CrmPricingQuoteLine[],
): Array<{ id: string; quantity?: number; unitAmount?: number | null }> {
  const out: Array<{ id: string; quantity?: number; unitAmount?: number | null }> = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.source !== 'order' || !line.optionId?.trim()) continue;
    const id = line.optionId.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      quantity: 1,
      ...(line.amountWon != null ? { unitAmount: line.amountWon } : {}),
    });
  }
  return out;
}
