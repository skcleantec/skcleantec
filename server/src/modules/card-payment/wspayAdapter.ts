/**
 * 선샤인페이 어댑터 — 공개 문서에 없는 body 필드는 보내지 않는다.
 * @see https://wspay.net/docs/
 */
import { WSPAY_KEYIN_FIELDS_CONFIRMED } from './wspayKeyin.payload.js';

export const WSPAY_BASE_URL = 'https://wspay.net';
export const WSPAY_KEYIN_PAY_PATH = '/api/v1/keyin/pay.php';
export const WSPAY_KEYIN_LIST_PATH = '/api/v1/keyin/list.php';

/** 카드번호는 우리 페이지가 아니라 원성페이먼츠 창에서만 입력한다. */
export function resolveWspayHostedWindowUrl(): string {
  return WSPAY_BASE_URL;
}

export type WspayCredential = {
  apiKey: string;
  tid: string;
  mid?: string | null;
  oid?: string | null;
};

export type WspayKeyinResult =
  | { ok: true; approvalNo: string; pgOrderId: string; cardLast4?: string }
  | { ok: false; code: 'schema_unconfirmed' | 'not_connected' | 'pg_error'; message: string };

export async function requestWspayKeyin(input: {
  credential: WspayCredential | null;
  amountWon: number;
  pgOrderId: string;
  customerName: string;
}): Promise<WspayKeyinResult> {
  if (!input.credential) {
    return { ok: false, code: 'not_connected', message: 'PG 키가 연결되지 않았습니다.' };
  }
  if (!WSPAY_KEYIN_FIELDS_CONFIRMED) {
    return {
      ok: false,
      code: 'schema_unconfirmed',
      message:
        '원성페이먼츠 수기결제 요청 필드가 아직 확정되지 않았습니다. 결제 건은 대기 상태로 둡니다.',
    };
  }
  void input.amountWon;
  void input.pgOrderId;
  void input.customerName;
  return {
    ok: false,
    code: 'schema_unconfirmed',
    message: '키인 페이로드가 문서와 맞는지 확인한 뒤에만 호출합니다.',
  };
}

export type WspayLinkResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; code: 'schema_unconfirmed' | 'not_connected'; message: string };

/**
 * 수기 조회 헤더. 문서의 X-TID 값은 숫자 TID가 아니라 가맹 MID(wspm…)입니다.
 * 숫자 TID를 넣으면 AUTH_INVALID_TID 가 납니다.
 */
export function wspayAuthHeaders(credential: WspayCredential): Record<string, string> {
  const headerTid = credential.mid?.trim() || credential.tid;
  return {
    'X-API-Key': credential.apiKey,
    'X-TID': headerTid,
    Accept: 'application/json',
  };
}

/** 승인 요청이 아닙니다. 수기 조회 API가 키를 받는지 확인합니다. */
export async function probeWspayListAuth(credential: WspayCredential): Promise<{
  httpStatus: number;
  accepted: boolean;
}> {
  const res = await fetch(`${WSPAY_BASE_URL}${WSPAY_KEYIN_LIST_PATH}`, {
    method: 'GET',
    headers: wspayAuthHeaders(credential),
  });
  await res.arrayBuffer();
  const accepted = res.status !== 401 && res.status !== 403;
  return { httpStatus: res.status, accepted };
}

export async function requestWspayPaymentLink(_input: {
  credential: WspayCredential | null;
  amountWon: number;
  pgOrderId: string;
}): Promise<WspayLinkResult> {
  return {
    ok: false,
    code: 'schema_unconfirmed',
    message: '고객 결제링크 API는 원성페이먼츠 문서 확인 후 연결합니다.',
  };
}
