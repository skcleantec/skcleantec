import crypto from 'node:crypto';

/** 페이시스 통합결제창. 카드번호는 이 창에서만 입력한다. */
const PAYSIS_WINDOW_BASE = (process.env.PAYSIS_WINDOW_BASE_URL || 'https://pgapi.paysis.co.kr').replace(
  /\/$/,
  '',
);

export function paysisSha256(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(''), 'utf8').digest('hex');
}

export type PaysisWindowRequest = {
  mid: string;
  mKey: string;
  type: 'P' | 'M';
  amount: string;
  productName: string;
  userId: string;
  userName: string;
  orderNo: string;
  returnUrl: string;
  successUrl: string;
  failUrl: string;
  closeUrl: string;
};

export async function requestPaysisPaymentWindow(
  input: PaysisWindowRequest,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; message: string }> {
  const urls = [input.returnUrl, input.successUrl, input.failUrl, input.closeUrl];
  if (urls.some((url) => url.length > 100)) {
    return { ok: false, message: '결제 결과 주소가 100자를 넘습니다. 공개 주소를 짧게 설정해 주세요.' };
  }
  const hashValue = paysisSha256([input.mid, input.type, input.orderNo, input.amount, input.mKey]);
  let res: Response;
  try {
    res = await fetch(`${PAYSIS_WINDOW_BASE}/dalgate/payment/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        mid: input.mid,
        type: input.type,
        amount: input.amount,
        productName: input.productName.slice(0, 50),
        userId: input.userId.slice(0, 30),
        userName: input.userName.slice(0, 50),
        orderNo: input.orderNo,
        hashValue,
        returnUrl: input.returnUrl,
        successUrl: input.successUrl,
        failUrl: input.failUrl,
        closeUrl: input.closeUrl,
      }),
    });
  } catch {
    return { ok: false, message: '페이시스 결제창 주소에 연결하지 못했습니다.' };
  }
  const json = (await res.json().catch(() => null)) as {
    resCode?: string;
    resMsg?: string;
    redirectUrl?: string;
  } | null;
  const redirectUrl = String(json?.redirectUrl ?? '');
  if (json?.resCode === '0000' && redirectUrl.startsWith('https://')) {
    return { ok: true, redirectUrl };
  }
  return { ok: false, message: json?.resMsg || '결제창 주소를 받지 못했습니다.' };
}

/** 페이시스 통합결제 당일 전액 취소. 부분 금액은 보내지 않는다. */
export async function requestPaysisFullCancel(input: {
  mid: string;
  ordNo: string;
  canNm: string;
  canMsg: string;
  canAmt: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch(`${PAYSIS_WINDOW_BASE}/api/v1/manual/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ordNo: input.ordNo,
        mid: input.mid,
        canNm: input.canNm.slice(0, 50),
        canMsg: input.canMsg.slice(0, 13),
        canAmt: input.canAmt,
      }),
    });
  } catch {
    return { ok: false, message: '페이시스 취소 요청에 연결하지 못했습니다.' };
  }
  const json = (await res.json().catch(() => null)) as { resCode?: string; resMsg?: string } | null;
  if (json?.resCode === '0000') return { ok: true };
  return { ok: false, message: json?.resMsg || '전액 취소를 하지 못했습니다.' };
}
