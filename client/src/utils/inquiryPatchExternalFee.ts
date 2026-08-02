/**
 * 접수 PATCH — 타업체 수수료 필드
 * mod_external_co off 테넌트는 `externalTransferFee: null`만 보내도 403이 나므로,
 * 값이 없고 기존에도 없을 때는 키 자체를 빼지 않는다.
 */
export function externalTransferFeeForInquiryPatch(
  formFeeRaw: string,
  previousFee: number | null | undefined,
): number | null | undefined {
  const t = formFeeRaw.replace(/,/g, '').trim();
  const next = t === '' ? null : parseInt(t, 10);
  if (t !== '' && (Number.isNaN(next!) || next! < 0)) {
    throw new Error('금액은 0 이상 정수로 입력해주세요.');
  }
  if (next != null) return next;
  if (previousFee != null) return null;
  return undefined;
}
