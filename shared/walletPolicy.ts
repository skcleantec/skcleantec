/** 청소비서 지갑 잔액이 이 금액보다 작으면 영수증 화면에서 경고한다. */
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

export const WALLET_USAGE_LABEL: Record<WalletUsageType, string> = {
  CASHBILL_ISSUE: '현금영수증 발행',
  CASHBILL_CANCEL: '현금영수증 취소',
  CASHBILL_REFUND: '현금영수증 환급',
  TAXINVOICE_ISSUE: '세금계산서 발행',
  TAXINVOICE_REFUND: '세금계산서 환급',
  ALIMTALK: '알림톡',
};
