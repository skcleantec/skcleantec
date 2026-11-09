import { validateAlimtalkTopUpAmountKrw } from './alimtalkPolicy.js';

/** 충전 모달의 1,000원 시험결제. Railway 변수 이름이 이 문자열과 같아야 한다. */
export const PAYMENT_TEST_AMOUNT_ENV = 'PAYMENT_TEST_AMOUNT_ENABLED';
export const PAYMENT_TEST_AMOUNT_KRW = 1000;

export function isPaymentTestAmountEnabled(): boolean {
  return process.env[PAYMENT_TEST_AMOUNT_ENV] === 'true';
}

/** 영수증 첫 시작 게이트에서 고르는 소액(1만·3만). 5만 단위 규칙과 함께 허용. */
const RECEIPT_SETUP_CHARGE_AMOUNTS = new Set([10_000, 30_000]);

/** 1,000원은 변수가 true일 때만 통과한다. 그 외 금액은 기존 5만 원 단위 규칙(+영수증 소액). */
export function validateWalletChargeAmountKrw(amountKrw: number): string | null {
  if (amountKrw === PAYMENT_TEST_AMOUNT_KRW) {
    return isPaymentTestAmountEnabled()
      ? null
      : '1,000원 시험결제는 이 환경에서 사용할 수 없습니다.';
  }
  if (RECEIPT_SETUP_CHARGE_AMOUNTS.has(amountKrw)) return null;
  return validateAlimtalkTopUpAmountKrw(amountKrw);
}
