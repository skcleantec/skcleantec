/** PC CRM → 앱 dispatch 시 inquiryId는 발신 번호와 일치할 때만 전달 */
export function resolveTelecrmDispatchInquiryId(
  dialPhone: string,
  inquiryId: string | null | undefined,
  inquiryPhone?: string | null,
): string | undefined {
  const id = inquiryId?.trim();
  if (!id) return undefined;
  const dialDigits = dialPhone.replace(/\D/g, '');
  const inqDigits = (inquiryPhone ?? '').replace(/\D/g, '');
  if (inqDigits.length >= 8 && dialDigits.length >= 8 && inqDigits !== dialDigits) {
    return undefined;
  }
  return id;
}

/** lookup 목록에서 발신 번호와 일치하는 접수 id */
export function findInquiryIdForDialPhone(
  dialPhone: string,
  inquiries: ReadonlyArray<{ id: string; customerPhone?: string | null }> | undefined,
): string | undefined {
  const dialDigits = dialPhone.replace(/\D/g, '');
  if (dialDigits.length < 8 || !inquiries?.length) return undefined;
  const matched = inquiries.find(
    (inq) => (inq.customerPhone ?? '').replace(/\D/g, '') === dialDigits,
  );
  return matched?.id;
}
