import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { hashLinkToken, maskCustomerPhone, newLinkToken } from './cardPayment.mask.js';
import { computeCardPaymentFees, defaultCardPaymentAmountWon } from './cardPaymentFee.js';
import { getDecryptedCredential } from './cardPaymentCredential.service.js';
import { resolveKeyinMerchant } from './cardPaymentMerchant.js';
import { getPlatformCardFeeRates } from './cardPayment.settings.service.js';
import { serializeCardPayment } from './cardPayment.serialize.js';
import { requestWspayPaymentLink, resolveWspayHostedWindowUrl } from './wspayAdapter.js';
import { buildWspayOrderId } from './wspayOrderId.js';
import { pgClerkStampForTeamLeader } from './pgClerk.service.js';

const PAYMENT_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  inquiry: { select: { id: true, inquiryNumber: true, customerName: true } },
} as const;

export async function loadInquiryForCardPayment(tenantId: string, inquiryId: string) {
  return prisma.inquiry.findFirst({
    where: { tenantId, id: inquiryId, deletedAt: null },
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      customerPhone: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
    },
  });
}

export async function quoteCardPayment(amountWon: number) {
  const rates = await getPlatformCardFeeRates();
  return computeCardPaymentFees(amountWon, rates.tenantFeeBps, rates.platformCostBps);
}

export async function createCardPaymentIntent(input: {
  tenantId: string;
  userId: string;
  inquiryId: string;
  amountWon: number;
  method: 'KEYIN' | 'CUSTOMER_LINK' | 'PAY_WINDOW';
  payScreen?: 'P' | 'M';
}) {
  const inquiry = await loadInquiryForCardPayment(input.tenantId, input.inquiryId);
  if (!inquiry) return { error: '접수를 찾을 수 없습니다.' as const };
  const amountWon = Math.round(Number(input.amountWon) || 0);
  if (amountWon < 100) return { error: '결제 금액은 100원 이상이어야 합니다.' as const };

  const rates = await getPlatformCardFeeRates();
  const fees = computeCardPaymentFees(amountWon, rates.tenantFeeBps, rates.platformCostBps);
  const clerkStamp = await pgClerkStampForTeamLeader(input.tenantId, input.userId);
  const created = await prisma.cardPayment.create({
    data: {
      tenantId: input.tenantId,
      inquiryId: inquiry.id,
      createdById: input.userId,
      method: input.method === 'CUSTOMER_LINK' ? 'CUSTOMER_LINK' : 'KEYIN',
      payRail: input.method,
      payScreen: input.payScreen ?? null,
      status: 'DRAFT',
      amountWon: fees.amountWon,
      tenantFeeBps: fees.tenantFeeBps,
      platformCostBps: fees.platformCostBps,
      tenantFeeWon: fees.tenantFeeWon,
      platformCostWon: fees.platformCostWon,
      platformSpreadWon: fees.platformSpreadWon,
      tenantNetWon: fees.tenantNetWon,
      customerName: inquiry.customerName,
      customerPhoneMasked: maskCustomerPhone(inquiry.customerPhone),
      inquiryNumber: inquiry.inquiryNumber,
      pgClerkNo: clerkStamp?.pgClerkNo ?? null,
      pgClerkCode: clerkStamp?.pgClerkCode ?? null,
    },
    include: PAYMENT_INCLUDE,
  });
  const merchant = await getDecryptedCredential(input.tenantId);
  const unique = created.id.replace(/-/g, '').slice(0, 16);
  const pgOrderId = (merchant?.oid ? buildWspayOrderId(merchant.oid, unique) : null) ?? `cbp${unique}`;
  const updated = await prisma.cardPayment.update({
    where: { id: created.id },
    data: { pgOrderId },
    include: PAYMENT_INCLUDE,
  });
  return { payment: serializeCardPayment(updated), suggestedAmountWon: defaultCardPaymentAmountWon(inquiry) };
}

export async function confirmKeyin(input: {
  tenantId: string;
  userId: string;
  paymentId: string;
}) {
  const row = await prisma.cardPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId, createdById: input.userId },
  });
  if (!row) return { error: '결제 건을 찾을 수 없습니다.' as const, status: 404 };
  if (row.method !== 'KEYIN') return { error: '수기결재 건이 아닙니다.' as const, status: 400 };
  if (row.status === 'APPROVED') return { error: '이미 결재완료된 건입니다.' as const, status: 409 };

  const merchant = await resolveKeyinMerchant(input.tenantId);
  const unique = row.id.replace(/-/g, '').slice(0, 16);
  const orderNo = merchant ? buildWspayOrderId(merchant.oid, unique)?.slice(0, 30) : null;
  const pgMessage = merchant
    ? '수기 API는 카드번호를 우리 서버가 원성페이에 보내야 합니다. 카드번호는 이 화면에 받지 않으므로, 결제는 결제창을 사용해 주세요.'
    : '이 업체 수기 키가 없습니다. 업체 가맹 키를 연결한 뒤에 진행할 수 있습니다.';

  const updated = await prisma.cardPayment.update({
    where: { id: row.id },
    data: {
      payRail: 'KEYIN',
      pgMid: merchant?.mid ?? null,
      pgOrderId: orderNo,
      status: 'AWAITING_PG',
      failReason: pgMessage.slice(0, 256),
    },
    include: PAYMENT_INCLUDE,
  });
  return {
    payment: serializeCardPayment(updated),
    pgReady: false,
    pgWindowUrl: '',
    pgMessage,
  };
}

export async function confirmCustomerLink(input: {
  tenantId: string;
  userId: string;
  paymentId: string;
}) {
  const row = await prisma.cardPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId, createdById: input.userId },
  });
  if (!row) return { error: '결제 건을 찾을 수 없습니다.' as const, status: 404 };
  if (row.method !== 'CUSTOMER_LINK') return { error: '고객링크 건이 아닙니다.' as const, status: 400 };
  if (row.status === 'APPROVED') return { error: '이미 결재완료된 건입니다.' as const, status: 409 };

  const token = newLinkToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const credential = await getDecryptedCredential(input.tenantId);
  const pg = await requestWspayPaymentLink({
    credential,
    amountWon: row.amountWon,
    pgOrderId: row.pgOrderId ?? row.id,
  });
  const updated = await prisma.cardPayment.update({
    where: { id: row.id },
    data: {
      linkTokenHash: hashLinkToken(token),
      linkExpiresAt: expires,
      status: 'LINK_SENT',
      failReason: pg.ok ? null : pg.message.slice(0, 256),
    },
    include: PAYMENT_INCLUDE,
  });
  const path = `/pay/card/${token}`;
  const url = `${getPublicAppBaseUrl()}${path}`;
  return {
    payment: serializeCardPayment(updated),
    linkUrl: url,
    linkPath: path,
    pgCheckoutUrl: pg.ok ? pg.checkoutUrl : null,
    pgWindowUrl: resolveWspayHostedWindowUrl(),
    pgMessage: pg.ok
      ? null
      : '고객이 링크를 열면 원성페이먼츠 창에서 카드번호를 입력합니다. 금액이 고정된 결제창 URL은 PG 문서 확인 후 연결합니다.',
  };
}

export async function getPublicPaymentByToken(token: string) {
  const hash = hashLinkToken(token);
  const row = await prisma.cardPayment.findFirst({
    where: { linkTokenHash: hash },
    include: {
      tenant: { select: { name: true } },
    },
  });
  if (!row) return null;
  if (row.linkExpiresAt && row.linkExpiresAt.getTime() < Date.now()) return { expired: true as const };
  return {
    customerName: row.customerName,
    amountWon: row.amountWon,
    status: row.status,
    tenantName: row.tenant.name,
    inquiryNumber: row.inquiryNumber,
    paidAt: row.paidAt?.toISOString() ?? null,
    pgWindowUrl: resolveWspayHostedWindowUrl(),
  };
}

export function newWebhookEventId(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 64);
}
