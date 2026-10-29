/** shared/walletPolicy.ts 와 같게 유지한다. */
export const WALLET_LOW_BALANCE_KRW = 1000;

export const WALLET_USAGE_TYPES = [
  'CASHBILL_ISSUE',
  'CASHBILL_CANCEL',
  'CASHBILL_REFUND',
  'TAXINVOICE_ISSUE',
  'TAXINVOICE_REFUND',
  'ALIMTALK',
] as const;

export type WalletUsageType = (typeof WALLET_USAGE_TYPES)[number];
