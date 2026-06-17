/** 견적서 과세 구분 — total(공급가액) 기준 */
export type QuotationVatMode = 'TAX_FREE' | 'VAT_SEPARATE';

export const QUOTATION_VAT_RATE = 0.1;

export function computeQuotationVatAmounts(
  supplyTotal: number,
  vatMode: QuotationVatMode,
): { supplyTotal: number; vatAmount: number; grandTotal: number } {
  const supply = Math.max(0, Math.round(supplyTotal));
  const vatAmount =
    vatMode === 'VAT_SEPARATE' ? Math.round(supply * QUOTATION_VAT_RATE) : 0;
  return { supplyTotal: supply, vatAmount, grandTotal: supply + vatAmount };
}

export function vatModeLabel(vatMode: QuotationVatMode): string {
  return vatMode === 'TAX_FREE' ? '면세' : '부가세 별도';
}

export function parseQuotationVatMode(raw: unknown): QuotationVatMode {
  if (raw === 'TAX_FREE' || raw === 'VAT_SEPARATE') return raw;
  return 'VAT_SEPARATE';
}

/** 행별 공급가·부가세·합계(금액) */
export function computeLineAmounts(
  supplyAmount: number,
  vatMode: QuotationVatMode,
): { supply: number; vatAmount: number; grandAmount: number } {
  const supply = Math.max(0, Math.round(supplyAmount));
  const vatAmount =
    vatMode === 'VAT_SEPARATE' ? Math.round(supply * QUOTATION_VAT_RATE) : 0;
  return { supply, vatAmount, grandAmount: supply + vatAmount };
}
