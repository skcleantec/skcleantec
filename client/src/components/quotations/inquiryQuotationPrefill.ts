/** 접수 데이터 → 견적 작성 prefill */
export function buildInquiryQuotationPrefill(row: Record<string, unknown>): {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  memo: string;
} {
  const customerName =
    (typeof row.customerName === 'string' && row.customerName.trim()) || '';
  const customerPhone =
    (typeof row.customerPhone === 'string' && row.customerPhone.trim()) ||
    (typeof row.customerPhone2 === 'string' && row.customerPhone2.trim()) ||
    '';
  const address = typeof row.address === 'string' ? row.address.trim() : '';
  const addressDetail =
    typeof row.addressDetail === 'string' ? row.addressDetail.trim() : '';
  const customerAddress =
    address && addressDetail ? `${address} ${addressDetail}` : address || addressDetail;
  const consultationMemo =
    typeof row.consultationMemo === 'string' ? row.consultationMemo.trim() : '';
  const specialNotes =
    typeof row.specialNotes === 'string' ? row.specialNotes.trim() : '';
  const memo = consultationMemo || specialNotes || '';
  return {
    customerName,
    customerPhone,
    customerEmail: '',
    customerAddress,
    memo,
  };
}

export function inquiryLabelFromRow(row: Record<string, unknown>): string {
  const num =
    typeof row.inquiryNumber === 'string' && row.inquiryNumber.trim()
      ? row.inquiryNumber.trim()
      : null;
  const name =
    typeof row.customerName === 'string' && row.customerName.trim()
      ? row.customerName.trim()
      : '접수';
  return num ? `${num} · ${name}` : name;
}
