/**
 * shared/barobillPolicy.ts 와 단가·코드를 같게 유지한다.
 * 서버 tsconfig rootDir 때문에 shared 를 직접 import 하지 않는다.
 */

export const CASHBILL_MODULE_ID = 'mod_cashbill' as const;

export const CASHBILL_UNIT_PRICE_KRW = 22;
export const CASHBILL_COST_KRW = 11;
export const TAXINVOICE_UNIT_PRICE_KRW = 150;
export const TAXINVOICE_COST_KRW = 110;
export const CORP_STATE_CHARGED_TO_TENANT = false;

export const BAROBILL_ALREADY_MEMBER_CODE = -32000;
/** 인증키에 회원사로 붙어 있지 않음. GetErrString: 해당 인증키와 연결된 연계사가 아닙니다. */
export const BAROBILL_NOT_LINKED_CODE = -10001;
export const BAROBILL_NOT_LINKED_TENANT_MESSAGE =
  '청소비서와 바로빌 연결이 아직 끝나지 않았어요. 잠시 후 다시 시도해 주세요.';

/** shared/barobillPolicy.ts BAROBILL_USER_ID_PATTERN 과 같게 유지한다. */
export const BAROBILL_USER_ID_PATTERN = /^[A-Za-z0-9._-]{4,50}$/;
export const BAROBILL_USER_ID_MESSAGE = '바로빌 아이디는 영문·숫자와 _ . - 만 쓸 수 있어요.';

/** shared/barobillPolicy.ts BAROBILL_PROCESSING_STALE_MS 와 같게 유지한다. */
export const BAROBILL_PROCESSING_STALE_MS = 10 * 60 * 1000;

export function publicBarobillMessage(code: number): string {
  if (code === BAROBILL_NOT_LINKED_CODE) return BAROBILL_NOT_LINKED_TENANT_MESSAGE;
  if (code === BAROBILL_ALREADY_MEMBER_CODE) {
    return `이미 바로빌에 가입된 사업자입니다. 콘솔에서 회원사 연결이 필요합니다. (${code})`;
  }
  if (code === -26006 || code === -26011) {
    return `바로빌 잔액이 부족합니다. (${code})`;
  }
  return `바로빌 처리에 실패했습니다. (${code})`;
}
