/** 견적서 공급받는자 — 손님 / 타업체 */
export type QuotationRecipientKind = 'CUSTOMER' | 'PARTNER';

export function parseQuotationRecipientKind(raw: unknown): QuotationRecipientKind | 'INVALID' {
  if (raw === undefined || raw === null || raw === '') return 'CUSTOMER';
  if (raw === 'CUSTOMER' || raw === 'PARTNER') return raw;
  return 'INVALID';
}

/** 비어 있으면 null. 숫자가 있으면 10자리만 허용하고 숫자만 반환. */
export function parseQuotationBizNo(raw: unknown): string | null | 'INVALID' {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'INVALID';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length !== 10) return 'INVALID';
  return digits;
}

export function formatQuotationBizNo(digits: string | null | undefined): string {
  const d = (digits ?? '').replace(/\D/g, '');
  if (d.length !== 10) return (digits ?? '').trim();
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function quotationRecipientLines(row: {
  recipientKind?: QuotationRecipientKind | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerBizNo?: string | null;
  customerRepName?: string | null;
}): string[] {
  const phone = row.customerPhone?.trim() ? `Tel ${row.customerPhone.trim()}` : null;
  const email = row.customerEmail?.trim() || null;
  const address = row.customerAddress?.trim() || null;
  if (row.recipientKind === 'PARTNER') {
    const biz = row.customerBizNo?.trim() ? `사업자 ${formatQuotationBizNo(row.customerBizNo)}` : null;
    const rep = row.customerRepName?.trim() ? `대표 ${row.customerRepName.trim()}` : null;
    return [row.customerName, rep, biz, phone, email, address].filter(Boolean) as string[];
  }
  return [row.customerName, phone, email, address].filter(Boolean) as string[];
}
