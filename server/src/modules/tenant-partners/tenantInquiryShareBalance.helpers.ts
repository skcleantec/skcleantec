/** 수신 mirror 접수 잔금 — 총액·예약금·파트너 수수료(transferFee) 기준 */

function truncWon(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.trunc(v);
}

export function computeTargetMirrorBalanceAmount(opts: {
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
  transferFee: number | null;
}): number | null {
  const fee = truncWon(opts.transferFee);
  const total = opts.serviceTotalAmount;
  if (total != null && Number.isFinite(total)) {
    const deposit = truncWon(opts.serviceDepositAmount);
    return Math.max(0, truncWon(total) - deposit - fee);
  }
  const balance = opts.serviceBalanceAmount;
  if (balance != null && Number.isFinite(balance)) {
    return Math.max(0, truncWon(balance) - fee);
  }
  return null;
}

/** 송신 원본 기준 잔금(수수료 미차감) — 연계 취소 시 mirror 복원용 */
export function computeSourceMirrorBalanceAmount(opts: {
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
}): number | null {
  const balance = opts.serviceBalanceAmount;
  if (balance != null && Number.isFinite(balance)) return Math.max(0, truncWon(balance));
  const total = opts.serviceTotalAmount;
  if (total != null && Number.isFinite(total)) {
    const deposit = truncWon(opts.serviceDepositAmount);
    return Math.max(0, truncWon(total) - deposit);
  }
  return null;
}
