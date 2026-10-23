import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { hashLinkToken, maskCustomerPhone, newLinkToken } from './cardPayment.mask.js';
import { computeCardPaymentFees, defaultCardPaymentAmountWon } from './cardPaymentFee.js';
import { getDecryptedCredential } from './cardPaymentCredential.service.js';
import { resolveKeyinMerchant } from './cardPaymentMerchant.js';
import { getPlatformCardFeeRates, resolveCardFeeRates } from './cardPayment.settings.service.js';
import { serializeCardPayment } from './cardPayment.serialize.js';
import { requestWspayPaymentLink, resolveWspayHostedWindowUrl } from './wspayAdapter.js';
import { chargeWspayKeyin, parseUsageFeeKeyinBody } from './cardPaymentUsageFeeKeyin.service.js';
import { buildWspayOrderId } from './wspayOrderId.js';
import { notifyCardPaymentApproved } from './cardPaymentPaidNotify.js';

const PAYMENT_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  inquiry: { select: { id: true, inquiryNumber: true, customerName: true, customerPhone: true } },
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

export async function quoteCardPayment(amountWon: number, tenantId?: string | null) {
  const rates = tenantId ? await resolveCardFeeRates(tenantId) : await getPlatformCardFeeRates();
  return computeCardPaymentFees(amountWon, rates.tenantFeeBps, rates.platformCostBps);
}

export async function createCardPaymentIntent(input: {
  tenantId: string;
  userId: string;
  inquiryId: string;
  amountWon: number;
  method: 'KEYIN' | 'CUSTOMER_LINK' | 'PAY_WINDOW';
  payScreen?: 'P' | 'M';
  goodsName?: string | null;
}) {
  const inquiry = await loadInquiryForCardPayment(input.tenantId, input.inquiryId);
  if (!inquiry) return { error: '접수를 찾을 수 없습니다.' as const };
  const amountWon = Math.round(Number(input.amountWon) || 0);
  if (amountWon < 100) return { error: '결제 금액은 100원 이상이어야 합니다.' as const };

  const rates = await resolveCardFeeRates(input.tenantId);
  if (rates.deleted) return { error: '가맹 연결이 해제되어 카드결재를 받을 수 없습니다.' as const };
  const fees = computeCardPaymentFees(amountWon, rates.tenantFeeBps, rates.platformCostBps);
  const goodsName = (input.goodsName ?? '').trim().slice(0, 80) || null;
  const method = input.method === 'CUSTOMER_LINK' ? 'CUSTOMER_LINK' : 'KEYIN';
  const open = await prisma.cardPayment.findFirst({
    where: {
      tenantId: input.tenantId,
      inquiryId: inquiry.id,
      method,
      status: { in: ['DRAFT', 'AWAITING_PG', 'LINK_SENT'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  const paymentData = {
    payRail: input.method,
    payScreen: input.payScreen ?? null,
    amountWon: fees.amountWon,
    tenantFeeBps: fees.tenantFeeBps,
    platformCostBps: fees.platformCostBps,
    tenantFeeWon: fees.tenantFeeWon,
    platformCostWon: fees.platformCostWon,
    platformSpreadWon: fees.platformSpreadWon,
    tenantNetWon: fees.tenantNetWon,
    customerName: inquiry.customerName,
    goodsName,
    customerPhoneMasked: maskCustomerPhone(inquiry.customerPhone),
    inquiryNumber: inquiry.inquiryNumber,
  };
  const created = open
    ? await prisma.cardPayment.update({
        where: { id: open.id },
        data: paymentData,
        include: PAYMENT_INCLUDE,
      })
    : await prisma.cardPayment.create({
        data: {
          tenantId: input.tenantId,
          inquiryId: inquiry.id,
          createdById: input.userId,
          method,
          status: 'DRAFT',
          ...paymentData,
        },
        include: PAYMENT_INCLUDE,
      });
  const merchant = await getDecryptedCredential(
    input.tenantId,
    input.method === 'CUSTOMER_LINK' ? 'LINK' : 'KEYIN',
  );
  const unique = created.id.replace(/-/g, '').slice(0, 16);
  const pgOrderId = created.pgOrderId
    || (merchant?.oid ? buildWspayOrderId(merchant.oid, unique) : null)
    || `cbp${unique}`;
  const updated = created.pgOrderId
    ? created
    : await prisma.cardPayment.update({
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
  body: unknown;
}) {
  const row = await prisma.cardPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId, createdById: input.userId },
  });
  if (!row) return { error: '결제 건을 찾을 수 없습니다.' as const, status: 404 };
  if (row.method !== 'KEYIN') return { error: '수기결재 건이 아닙니다.' as const, status: 400 };
  if (row.status === 'APPROVED') return { error: '이미 결재완료된 건입니다.' as const, status: 409 };

  const merchant = await resolveKeyinMerchant(input.tenantId);
  if (!merchant) {
    return { error: '이 업체 수기 키가 없습니다. PG 수기 연결 후 사용할 수 있습니다.' as const, status: 400 };
  }
  const raw = input.body && typeof input.body === 'object' ? { ...(input.body as Record<string, unknown>) } : {};
  raw.goodsName = (row.goodsName || `${row.customerName} 청소비`).slice(0, 40);
  raw.amountWon = row.amountWon;
  raw.buyerName = row.customerName;
  const parsed = parseUsageFeeKeyinBody(raw);
  if ('error' in parsed) return { error: parsed.error, status: 400 as const };

  const unique = row.id.replace(/-/g, '').slice(0, 16);
  const orderNo = (row.pgOrderId && row.pgOrderId.startsWith(merchant.oid) ? row.pgOrderId : null)
    ?? buildWspayOrderId(merchant.oid, unique);
  if (!orderNo) return { error: '주문번호를 만들지 못했습니다.' as const, status: 400 };

  const charged = await chargeWspayKeyin(merchant, orderNo.slice(0, 30), parsed.input);
  if ('error' in charged) return { error: charged.error, status: charged.status };

  const approved = charged.result.ok;
  const updated = await prisma.cardPayment.update({
    where: { id: row.id },
    data: {
      payRail: 'KEYIN',
      pgMid: merchant.mid,
      pgOrderId: charged.result.orderNo?.slice(0, 64) ?? orderNo.slice(0, 30),
      status: approved ? 'APPROVED' : 'FAILED',
      cardLast4: approved ? charged.result.cardLast4 ?? null : null,
      approvalNo: approved ? charged.result.approvalNo ?? null : null,
      paidAt: approved ? new Date() : null,
      failReason: approved ? null : charged.result.message.slice(0, 256),
    },
    include: PAYMENT_INCLUDE,
  });
  if (approved) await notifyCardPaymentApproved(input.tenantId, updated.inquiryId);
  return {
    payment: serializeCardPayment(updated),
    ok: approved,
    message: charged.result.message,
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
  const credential = await getDecryptedCredential(input.tenantId, 'LINK');
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
      failReason: null,
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
    pgMessage: null,
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
    goodsName: row.goodsName,
    paidAt: row.paidAt?.toISOString() ?? null,
    pgWindowUrl: resolveWspayHostedWindowUrl(),
  };
}

export function newWebhookEventId(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 64);
}
