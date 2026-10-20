import { prisma } from '../../lib/prisma.js';
import { resolveWindowMerchant } from './cardPaymentMerchant.js';
import { requestPaysisFullCancel } from './paysisWindow.adapter.js';

function kstYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

/** 인증(고객 링크) 당일 전액 취소. 페이시스 취소 API만 호출한다. */
export async function cancelCustomerLinkPayment(input: {
  tenantId: string;
  paymentId: string;
  actorName: string;
}): Promise<{ error: string; status: 400 | 404 } | { ok: true }> {
  const row = await prisma.cardPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId },
  });
  if (!row) return { error: '결제 건을 찾을 수 없습니다.', status: 404 };
  if (row.method !== 'CUSTOMER_LINK') {
    return { error: '인증결재만 여기서 취소할 수 있습니다. 수기는 판매자센터에서 취소합니다.', status: 400 };
  }
  if (row.status !== 'APPROVED' || !row.paidAt) {
    return { error: '결재완료된 건만 취소할 수 있습니다.', status: 400 };
  }
  if (kstYmd(row.paidAt) !== kstYmd(new Date())) {
    return { error: '결제 당일에만 전액 취소할 수 있습니다.', status: 400 };
  }
  const merchant = await resolveWindowMerchant(input.tenantId);
  const mid = row.pgMid?.trim() || merchant?.mid;
  const ordNo = row.pgOrderId?.trim();
  if (!mid || !ordNo) return { error: '주문번호가 없어 취소할 수 없습니다.', status: 400 };

  const cancelled = await requestPaysisFullCancel({
    mid,
    ordNo,
    canNm: input.actorName.trim().slice(0, 50) || '관리자',
    canMsg: '인증전액취소',
    canAmt: String(row.amountWon),
  });
  if (!cancelled.ok) return { error: cancelled.message, status: 400 };

  await prisma.cardPayment.updateMany({
    where: { id: row.id, tenantId: input.tenantId, status: 'APPROVED' },
    data: { status: 'CANCELLED' },
  });
  return { ok: true };
}
