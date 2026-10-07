import { prisma } from '../../lib/prisma.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { applyUsageFeePaysisNotification } from './usageFeeCardPayment.service.js';
import { paysisSha256, requestPaysisPaymentWindow } from './paysisWindow.adapter.js';
import { resolveWindowMerchant } from './cardPaymentMerchant.js';
import { buildWspayOrderId } from './wspayOrderId.js';
import { serializeCardPayment } from './cardPayment.serialize.js';
import { hashLinkToken } from './cardPayment.mask.js';

const PAYMENT_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  inquiry: { select: { id: true, inquiryNumber: true, customerName: true } },
} as const;

function windowUrls() {
  const base = getPublicAppBaseUrl();
  return {
    returnUrl: `${base}/api/public/card-payment/paysis-noti`,
    successUrl: `${base}/pay/paysis/ok`,
    failUrl: `${base}/pay/paysis/fail`,
    closeUrl: `${base}/pay/paysis/close`,
  };
}

export async function startPaysisWindow(input: {
  tenantId: string;
  paymentId: string;
  payScreen: 'P' | 'M';
}) {
  const row = await prisma.cardPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId },
  });
  if (!row) return { error: '결제 건을 찾을 수 없습니다.' as const, status: 404 };
  if (row.status === 'APPROVED') return { error: '이미 결재완료된 건입니다.' as const, status: 409 };
  const merchant = await resolveWindowMerchant(input.tenantId);
  if (!merchant) {
    return {
      error: '이 업체 결제창 키가 없습니다. 업체 가맹 키를 연결한 뒤에 결제할 수 있습니다.' as const,
      status: 400,
    };
  }
  const unique = `${Date.now().toString(36)}${row.id.replace(/-/g, '').slice(0, 8)}`;
  const orderNo = buildWspayOrderId(merchant.oid, unique)?.slice(0, 30);
  if (!orderNo) return { error: '주문번호를 만들지 못했습니다.' as const, status: 400 };
  const userId = (row.inquiryNumber || row.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 30) || 'guest';
  const opened = await requestPaysisPaymentWindow({
    mid: merchant.mid,
    mKey: merchant.mKey,
    type: input.payScreen,
    amount: String(row.amountWon),
    productName: '청소서비스',
    userId,
    userName: row.customerName || '고객',
    orderNo,
    ...windowUrls(),
  });
  if (!opened.ok) return { error: opened.message, status: 502 as const };
  const updated = await prisma.cardPayment.update({
    where: { id: row.id },
    data: {
      payRail: 'PAY_WINDOW',
      payScreen: input.payScreen,
      pgMid: merchant.mid,
      pgOrderId: orderNo,
      status: 'AWAITING_PG',
      failReason: null,
    },
    include: PAYMENT_INCLUDE,
  });
  return {
    payment: serializeCardPayment(updated),
    pgReady: true as const,
    redirectUrl: opened.redirectUrl,
  };
}

export async function startPaysisWindowByLinkToken(token: string, payScreen: 'P' | 'M') {
  const row = await prisma.cardPayment.findFirst({
    where: { linkTokenHash: hashLinkToken(token) },
  });
  if (!row) return { error: '결제 링크가 없거나 만료되었습니다.' as const, status: 404 };
  if (row.linkExpiresAt && row.linkExpiresAt.getTime() < Date.now()) {
    return { error: '결제 링크가 만료되었습니다.' as const, status: 410 };
  }
  return startPaysisWindow({ tenantId: row.tenantId, paymentId: row.id, payScreen });
}

export async function applyPaysisNotification(body: unknown): Promise<'SUCCESS' | 'FAIL'> {
  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const orderNo = String(rec.orderNo ?? '').trim();
  const amount = String(rec.amount ?? '').trim();
  const givenHash = String(rec.hashValue ?? '').trim().toLowerCase();
  if (!orderNo || !amount || !givenHash) return 'FAIL';
  const row = await prisma.cardPayment.findFirst({ where: { pgOrderId: orderNo } });
  if (!row) {
    const usage = await applyUsageFeePaysisNotification(rec);
    return usage ?? 'FAIL';
  }
  if (!row.pgMid || !row.payScreen) return 'FAIL';
  if (Number(amount) !== row.amountWon) return 'FAIL';
  const expected = paysisSha256([row.pgMid, row.payScreen, orderNo, amount]);
  if (expected !== givenHash) return 'FAIL';
  if (row.status !== 'APPROVED') {
    const masked = String(rec.cardNo ?? '');
    const last4 = masked.includes('*') ? masked.replace(/\D/g, '').slice(-4) : null;
    await prisma.cardPayment.update({
      where: { id: row.id },
      data: {
        status: 'APPROVED',
        paidAt: new Date(),
        approvalNo: String(rec.authNo ?? '').slice(0, 64) || null,
        cardLast4: last4 && last4.length === 4 ? last4 : null,
        failReason: null,
      },
    });
  }
  return 'SUCCESS';
}
