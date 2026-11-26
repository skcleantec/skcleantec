import type { EditableQuotationLine } from './quotationLineUtils';

/** 화면에 있는 견적 내용. 수신 이메일은 발송 칸이라 여기 넣지 않는다. */
export function quotationDraftMark(input: {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  recipientKind?: string;
  customerBizNo?: string;
  customerRepName?: string;
  memo: string;
  discountAmount: string;
  validUntil: string;
  documentType: string;
  vatMode: string;
  operatingCompanyId: string;
  lines: Pick<EditableQuotationLine, 'catalogItemId' | 'label' | 'unitPrice' | 'quantity'>[];
}): string {
  return JSON.stringify({
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerAddress: input.customerAddress.trim(),
    recipientKind: input.recipientKind ?? 'CUSTOMER',
    customerBizNo: (input.customerBizNo ?? '').trim(),
    customerRepName: (input.customerRepName ?? '').trim(),
    memo: input.memo.trim(),
    discountAmount: input.discountAmount.trim(),
    validUntil: input.validUntil.trim(),
    documentType: input.documentType,
    vatMode: input.vatMode,
    operatingCompanyId: input.operatingCompanyId,
    lines: input.lines.map((li) => ({
      catalogItemId: li.catalogItemId,
      label: li.label.trim(),
      unitPrice: li.unitPrice.trim(),
      quantity: li.quantity.trim(),
    })),
  });
}
