/** @see shared/quotationRecipient.ts — 클라이언트와 동기화 */
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

type RecipientExisting = {
  recipientKind: QuotationRecipientKind;
  customerBizNo: string | null;
  customerRepName: string | null;
};

export function resolveQuotationRecipient(
  body: Record<string, unknown>,
  existing?: RecipientExisting,
):
  | {
      recipientKind: QuotationRecipientKind;
      customerBizNo: string | null;
      customerRepName: string | null;
    }
  | { error: string } {
  const kindRaw = body.recipientKind !== undefined ? body.recipientKind : (existing?.recipientKind ?? 'CUSTOMER');
  const kind = parseQuotationRecipientKind(kindRaw);
  if (kind === 'INVALID') return { error: '공급받는자 구분이 올바르지 않습니다.' };
  if (kind === 'CUSTOMER') {
    return { recipientKind: 'CUSTOMER', customerBizNo: null, customerRepName: null };
  }

  const bizRaw = body.customerBizNo !== undefined ? body.customerBizNo : (existing?.customerBizNo ?? null);
  const biz =
    typeof bizRaw === 'string' || bizRaw === null ? parseQuotationBizNo(bizRaw ?? '') : 'INVALID';
  if (biz === 'INVALID') return { error: '사업자번호는 숫자 10자리로 입력해 주세요.' };

  const repRaw = body.customerRepName !== undefined ? body.customerRepName : (existing?.customerRepName ?? null);
  let customerRepName: string | null = null;
  if (typeof repRaw === 'string' && repRaw.trim()) customerRepName = repRaw.trim().slice(0, 80);
  else if (repRaw != null && typeof repRaw !== 'string') {
    return { error: '대표자 이름이 올바르지 않습니다.' };
  }

  return { recipientKind: 'PARTNER', customerBizNo: biz, customerRepName };
}
