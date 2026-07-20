/**
 * 타업체·테넌트 파트너 정산 — 미수(발생) 반영액.
 *
 * 취소 건은 −수수료로 잡지 않는다. 배정·수수료 확정 후 취소되면
 * 「받았다가 돌려주는」 순 0이므로 미수 합계에서 제외(활성 건만 +수수료).
 */
export function signedExternalSettlementFee(fee: number, isCancelled: boolean): number {
  if (isCancelled || !Number.isFinite(fee) || fee === 0) return 0;
  return fee;
}
