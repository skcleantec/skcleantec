import { loadServiceBridgeMerchants } from './serviceBridgeWspay.js';
import { WSPAY_BASE_URL, WSPAY_KEYIN_PAY_PATH, wspayAuthHeaders } from './wspayAdapter.js';
import { buildWspayOrderId } from './wspayOrderId.js';

export type UsageFeeKeyinInput = {
  goodsName: string;
  amountWon: number;
  cardNo: string;
  expireYY: string;
  expireMM: string;
  installment: string;
  certPw: string;
  certNo: string;
  buyerName: string;
  buyerPhone: string;
};

export type UsageFeeKeyinResult = {
  ok: boolean;
  message: string;
  approvalNo?: string;
  orderNo?: string;
  amountWon?: number;
  cardLast4?: string;
};

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function redactPan(message: string): string {
  return message.replace(/\d{13,19}/g, '****');
}

function readString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function parseUsageFeeKeyinBody(body: unknown): { error: string } | { input: UsageFeeKeyinInput } {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const goodsName = readString(raw.goodsName, 40);
  const buyerName = readString(raw.buyerName, 30);
  const amountWon = Number(String(raw.amountWon ?? '').replace(/,/g, ''));
  const cardNo = digits(readString(raw.cardNo, 24));
  const expireMM = digits(readString(raw.expireMM, 2));
  const expireYY = digits(readString(raw.expireYY, 2));
  const installment = digits(readString(raw.installment, 2)) || '00';
  const certPw = digits(readString(raw.certPw, 2));
  const certNo = digits(readString(raw.certNo, 10));
  const buyerPhone = digits(readString(raw.buyerPhone, 16));

  if (!goodsName) return { error: '상품명을 입력하세요.' };
  if (!Number.isInteger(amountWon) || amountWon < 100 || amountWon > 10_000_000) {
    return { error: '승인금액은 100원 이상 1,000만원 이하로 입력하세요.' };
  }
  if (cardNo.length < 14 || cardNo.length > 16) return { error: '카드번호는 숫자 14~16자리입니다.' };
  if (!/^(0[1-9]|1[0-2])$/.test(expireMM) || !/^\d{2}$/.test(expireYY)) {
    return { error: '유효기간을 선택하세요.' };
  }
  if (!/^(00|0[2-9]|1[0-2])$/.test(installment)) return { error: '할부개월을 선택하세요.' };
  if (!/^\d{2}$/.test(certPw)) return { error: '카드 비밀번호 앞 2자리를 입력하세요.' };
  if (!/^(\d{6}|\d{10})$/.test(certNo)) {
    return { error: '생년월일 6자리 또는 사업자번호 10자리를 입력하세요.' };
  }
  if (!buyerName) return { error: '구매자명을 입력하세요.' };
  return {
    input: { goodsName, amountWon, cardNo, expireYY, expireMM, installment, certPw, certNo, buyerName, buyerPhone },
  };
}

/** 서비스브릿지 수기 키로만 승인 요청. 카드번호는 저장하지 않는다. */
export async function chargeUsageFeeKeyin(input: UsageFeeKeyinInput): Promise<
  { error: string; status: 400 } | { result: UsageFeeKeyinResult }
> {
  const keyin = loadServiceBridgeMerchants().keyin;
  if (!keyin) return { error: '이용료 수기 키가 서버에 없습니다.', status: 400 };
  const orderNo = buildWspayOrderId(keyin.oid, `FEE${Date.now()}`);
  if (!orderNo) return { error: '이용료 주문번호를 만들지 못했습니다.', status: 400 };

  const payload: Record<string, string | number> = {
    amount: input.amountWon,
    goods_name: input.goodsName,
    buyer_name: input.buyerName,
    card_no: input.cardNo,
    expire_yymm: `${input.expireYY}${input.expireMM}`,
    installment: input.installment,
    cert_pw: input.certPw,
    cert_no: input.certNo,
    order_no: orderNo,
  };
  if (input.buyerPhone) payload.buyer_phone = input.buyerPhone;

  let response: Response;
  try {
    response = await fetch(`${WSPAY_BASE_URL}${WSPAY_KEYIN_PAY_PATH}`, {
      method: 'POST',
      headers: {
        ...wspayAuthHeaders(keyin),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { error: '원성페이먼츠에 연결하지 못했습니다.', status: 400 };
  }

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    const json = JSON.parse(text) as unknown;
    if (json && typeof json === 'object') parsed = json as Record<string, unknown>;
  } catch {
    return { error: '원성페이먼츠 응답을 읽지 못했습니다.', status: 400 };
  }

  const data =
    parsed.data && typeof parsed.data === 'object' ? (parsed.data as Record<string, unknown>) : parsed;
  const message = redactPan(
    typeof parsed.message === 'string' && parsed.message
      ? parsed.message
      : response.ok
        ? '결제를 처리했습니다.'
        : '결제에 실패했습니다.',
  );
  const approved = parsed.success === true;
  const approvalNo = typeof data.app_no === 'string' ? data.app_no : undefined;
  const returnedOrder = typeof data.order_no === 'string' ? data.order_no : orderNo;
  if (!approved) {
    return { result: { ok: false, message, orderNo: returnedOrder, amountWon: input.amountWon } };
  }
  return {
    result: {
      ok: true,
      message: approvalNo ? `승인되었습니다. 승인번호 ${approvalNo}` : message,
      approvalNo,
      orderNo: returnedOrder,
      amountWon: input.amountWon,
      cardLast4: input.cardNo.slice(-4),
    },
  };
}
