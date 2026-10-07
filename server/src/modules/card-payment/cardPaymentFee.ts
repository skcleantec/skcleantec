/** shared/cardPayment.ts 와 동일 공식 — 서버 rootDir 밖으로 import 하지 않음 */
export const DEFAULT_TENANT_CARD_FEE_BPS = 330;
export const DEFAULT_PLATFORM_CARD_COST_BPS = 260;

export function computeCardPaymentFees(
  amountWon: number,
  tenantFeeBps: number = DEFAULT_TENANT_CARD_FEE_BPS,
  platformCostBps: number = DEFAULT_PLATFORM_CARD_COST_BPS,
) {
  const amount = Math.max(0, Math.round(Number(amountWon) || 0));
  const tenantBps = clampBps(tenantFeeBps);
  const costBps = clampBps(platformCostBps);
  const tenantFeeWon = Math.round((amount * tenantBps) / 10_000);
  const platformCostWon = Math.round((amount * costBps) / 10_000);
  return {
    amountWon: amount,
    tenantFeeBps: tenantBps,
    platformCostBps: costBps,
    tenantFeeWon,
    platformCostWon,
    platformSpreadWon: tenantFeeWon - platformCostWon,
    tenantNetWon: amount - tenantFeeWon,
  };
}

export function defaultCardPaymentAmountWon(input: {
  serviceBalanceAmount?: number | null;
  serviceTotalAmount?: number | null;
  serviceDepositAmount?: number | null;
}): number {
  const balance = toWon(input.serviceBalanceAmount);
  if (balance > 0) return balance;
  const total = toWon(input.serviceTotalAmount);
  const deposit = toWon(input.serviceDepositAmount);
  if (total > 0 && total >= deposit) return total - deposit;
  return total;
}

function clampBps(n: number): number {
  const v = Math.round(Number(n) || 0);
  if (v < 0) return 0;
  if (v > 10_000) return 10_000;
  return v;
}

function toWon(n: number | null | undefined): number {
  const v = Math.round(Number(n) || 0);
  return v > 0 ? v : 0;
}
