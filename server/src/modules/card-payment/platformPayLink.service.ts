import { randomBytes } from 'node:crypto';
import type { UsageFeeCardPaymentPurpose } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { kstYmdFromDate } from '../billing/tenantBilling.dates.js';
import { PLATFORM_PG_AGENCY_ID, readPlatformAgencySecrets } from './platformPgAgency.service.js';
import { listUsageFeeOpenPeriods, usageFeeStatusLabel } from './usageFeeCardPayment.service.js';
import { loadServiceBridgeMerchants } from './serviceBridgeWspay.js';
import { requestPaysisPaymentWindow } from './paysisWindow.adapter.js';
import { buildWspayOrderId } from './wspayOrderId.js';
import { buildServiceBridgePayLinkView, type PublicPayLinkView } from './publicPayLink.service.js';
import { splitTaxIncluded } from './cardVat.js';

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LINK_DAYS = 7;
const PURPOSES = new Set<UsageFeeCardPaymentPurpose>(['INVOICE', 'OTHER', 'CLEANING_PROXY']);

export type PlatformPayPurpose = 'INVOICE' | 'OTHER' | 'CLEANING_PROXY';

type ApiFail = { error: string; status: number };

function clip(raw: unknown, max: number): string {
  return typeof raw === 'string' ? raw.trim().slice(0, max) : '';
}

function purposeOf(raw: unknown): PlatformPayPurpose | null {
  return typeof raw === 'string' && PURPOSES.has(raw as UsageFeeCardPaymentPurpose)
    ? (raw as PlatformPayPurpose)
    : null;
}

function makeToken(): string {
  const bytes = randomBytes(8);
  return [...bytes].map((byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
}

export function serviceBridgePayUrl(token: string): string {
  return `${getPublicAppBaseUrl()}/pay/sb/${token}`;
}

function linkClosed(row: { linkClosedAt: Date | null; linkExpiresAt: Date | null; status: string }): boolean {
  return usageFeeStatusLabel(row) === '링크 만료';
}

export async function platformSellerCenterStatus(): Promise<{ saved: boolean; loginIdPrefix: string }> {
  const row = await prisma.platformPgAgency.findUnique({
    where: { id: PLATFORM_PG_AGENCY_ID },
    select: { sellerCenterLoginId: true, sellerCenterPasswordEnc: true },
  });
  const loginId = row?.sellerCenterLoginId?.trim() ?? '';
  const saved = Boolean(loginId && row?.sellerCenterPasswordEnc);
  return { saved, loginIdPrefix: saved ? loginId.slice(0, 2) : '' };
}

export async function revealPlatformSellerCenter(): Promise<ApiFail | { loginId: string; password: string }> {
  const row = await prisma.platformPgAgency.findUnique({
    where: { id: PLATFORM_PG_AGENCY_ID },
    select: { sellerCenterLoginId: true, sellerCenterPasswordEnc: true },
  });
  const loginId = row?.sellerCenterLoginId?.trim() ?? '';
  if (!loginId || !row?.sellerCenterPasswordEnc) {
    return { error: '판매자센터 아이디가 저장돼 있지 않아요', status: 404 };
  }
  const secrets = await readPlatformAgencySecrets('KEYIN');
  if (!secrets?.sellerPassword) {
    return { error: '판매자센터 아이디가 저장돼 있지 않아요', status: 404 };
  }
  return { loginId, password: secrets.sellerPassword };
}

function inquiryCaption(row: {
  customerName: string;
  preferredDate: Date | null;
  address: string;
}): string {
  const ymd = row.preferredDate ? kstYmdFromDate(row.preferredDate) : '';
  const day = ymd ? `${ymd.slice(5, 7)}.${ymd.slice(8, 10)}` : '';
  const place = row.address.split(/\s+/).slice(0, 2).join(' ');
  return [day, row.customerName, place].filter(Boolean).join(' · ');
}

export async function searchPayLinkInquiries(tenantId: string, q: string) {
  const tenant = tenantId.trim();
  const query = q.trim();
  if (!tenant || query.length < 1) return [];
  const rows = await prisma.inquiry.findMany({
    where: {
      tenantId: tenant,
      OR: [
        { customerName: { contains: query, mode: 'insensitive' } },
        { inquiryNumber: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, customerName: true, preferredDate: true, address: true, inquiryNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  return rows.map((row) => ({
    id: row.id,
    label: inquiryCaption(row),
    inquiryNumber: row.inquiryNumber,
  }));
}

export async function createPlatformPayLink(
  body: unknown,
  platformUserId: string,
): Promise<
  | ApiFail
  | {
      result: {
        id: string;
        url: string;
        amountKrw: number;
        buyerName: string | null;
        tenantName: string | null;
        expiresAt: string;
        goodsName: string;
      };
    }
> {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const purpose = purposeOf(raw.purpose);
  if (!purpose) return { error: '용도를 선택하세요.', status: 400 as const };
  const tenantId = clip(raw.tenantId, 80);
  const goodsName = clip(raw.goodsName, 80);
  const buyerName = clip(raw.buyerName, 40);
  const buyerPhone = clip(raw.buyerPhone, 32).replace(/[^\d]/g, '').slice(0, 11);
  const memo = clip(raw.memo, 500);
  const inquiryId = clip(raw.inquiryId, 80);
  const amountWon = Number(raw.amountWon);
  if (!goodsName) return { error: '상품명을 입력하세요.', status: 400 as const };
  if (!Number.isInteger(amountWon) || amountWon < 100 || amountWon > 10_000_000) {
    return { error: '금액은 100원에서 1,000만 원 사이입니다.', status: 400 as const };
  }
  if (!buyerName) return { error: '고객 이름을 입력하세요.', status: 400 as const };

  let periodStart: Date | null = null;
  const taxed = splitTaxIncluded(amountWon);
  let supplyAmountKrw = taxed.supplyKrw;
  let vatAmountKrw = taxed.vatKrw;
  if (purpose === 'INVOICE') {
    const periodStartYmd = clip(raw.periodStartYmd, 10);
    if (!tenantId) return { error: '업체를 선택하세요.', status: 400 as const };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStartYmd)) return { error: '결제할 달을 선택하세요.', status: 400 as const };
    const opened = await listUsageFeeOpenPeriods(tenantId);
    if ('error' in opened) return { error: opened.error, status: opened.status };
    const period = opened.items.find((item) => item.periodStartYmd === periodStartYmd);
    if (!period) return { error: '선택한 달은 아직 낼 이용료가 없습니다.', status: 400 as const };
    if (period.chargeAmountKrw !== amountWon) {
      return { error: `이 달 금액은 ${period.chargeAmountKrw.toLocaleString('ko-KR')}원입니다.`, status: 400 as const };
    }
    periodStart = new Date(`${periodStartYmd}T00:00:00+09:00`);
    supplyAmountKrw = period.supplyAmountKrw;
    vatAmountKrw = period.vatAmountKrw;
  } else if (purpose === 'CLEANING_PROXY') {
    if (!tenantId) return { error: '청소한 업체를 선택하세요.', status: 400 as const };
  } else if (!memo) {
    return { error: '기타 결제는 내부 메모를 입력하세요.', status: 400 as const };
  }

  if (tenantId) {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { id: true, name: true } });
    if (!tenant) return { error: '업체를 찾을 수 없습니다.', status: 404 as const };
  }
  if (inquiryId) {
    if (!tenantId) return { error: '접수를 고르려면 업체를 먼저 선택하세요.', status: 400 as const };
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      select: { id: true },
    });
    if (!inquiry) return { error: '접수를 찾을 수 없습니다.', status: 404 as const };
  }

  const expires = new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000);
  let token = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    token = makeToken();
    const taken = await prisma.usageFeeCardPayment.findFirst({ where: { linkToken: token }, select: { id: true } });
    if (!taken) break;
    token = '';
  }
  if (!token) return { error: '링크를 만들지 못했습니다. 다시 시도해 주세요.', status: 400 as const };

  const row = await prisma.usageFeeCardPayment.create({
    data: {
      purpose,
      payMethod: 'PAY_WINDOW',
      status: 'PENDING',
      tenantId: tenantId || null,
      periodStart,
      goodsName,
      supplyAmountKrw,
      vatAmountKrw,
      amountKrw: amountWon,
      buyerName,
      buyerPhone: buyerPhone || null,
      inquiryId: inquiryId || null,
      memo: memo || null,
      linkToken: token,
      linkExpiresAt: expires,
      invoiceApplied: false,
      paidAt: new Date(),
      createdByPlatformUserId: platformUserId,
    },
    include: { tenant: { select: { name: true } } },
  });
  return {
    result: {
      id: row.id,
      url: serviceBridgePayUrl(token),
      amountKrw: row.amountKrw,
      buyerName: row.buyerName,
      tenantName: row.tenant?.name ?? null,
      expiresAt: expires.toISOString(),
      goodsName: row.goodsName,
    },
  };
}

export async function closePlatformPayLink(id: string): Promise<ApiFail | { ok: true }> {
  const row = await prisma.usageFeeCardPayment.findFirst({
    where: { id, linkToken: { not: null } },
    select: { id: true, status: true, linkClosedAt: true },
  });
  if (!row) return { error: '링크를 찾을 수 없습니다.', status: 404 as const };
  if (row.status !== 'PENDING') return { error: '이미 결제가 끝난 링크는 닫을 수 없습니다.', status: 400 as const };
  await prisma.usageFeeCardPayment.updateMany({
    where: { id: row.id, status: 'PENDING' },
    data: { linkClosedAt: new Date() },
  });
  return { ok: true };
}

export async function getPublicServiceBridgeLink(token: string): Promise<ApiFail | { result: PublicPayLinkView }> {
  const view = await buildServiceBridgePayLinkView(token);
  if (!view) return { error: '결제 링크가 없거나 만료되었습니다.', status: 404 as const };
  return { result: view };
}

export async function openServiceBridgeLinkWindow(
  token: string,
  payScreen: 'P' | 'M',
): Promise<ApiFail | { redirectUrl: string }> {
  const row = await prisma.usageFeeCardPayment.findFirst({ where: { linkToken: token } });
  if (!row) return { error: '결제 링크가 없거나 만료되었습니다.', status: 404 as const };
  if (row.status === 'APPROVED') return { error: '이미 결제가 완료되었습니다.', status: 400 as const };
  if (row.status !== 'PENDING' || linkClosed(row)) {
    return { error: '이 링크는 만료되었습니다.', status: 410 as const };
  }
  const app = (await loadServiceBridgeMerchants()).appCard;
  if (!app) return { error: '결제창 키가 서버에 없습니다.', status: 400 as const };
  const base = getPublicAppBaseUrl();
  const screen = row.payScreen === 'M' || row.payScreen === 'P' ? row.payScreen : payScreen;
  let orderNo = row.pgOrderId;
  if (!orderNo) {
    orderNo = buildWspayOrderId(app.oid, `sb${Date.now().toString(36)}`)?.slice(0, 30) ?? null;
    if (!orderNo) return { error: '주문번호를 만들지 못했습니다.', status: 400 as const };
    const claimed = await prisma.usageFeeCardPayment.updateMany({
      where: { id: row.id, status: 'PENDING', pgOrderId: null },
      data: { pgOrderId: orderNo, pgMid: app.mid, payScreen: screen },
    });
    if (claimed.count !== 1) {
      const again = await prisma.usageFeeCardPayment.findFirst({
        where: { id: row.id },
        select: { pgOrderId: true, payScreen: true },
      });
      orderNo = again?.pgOrderId ?? null;
      if (!orderNo) return { error: '결제창을 열지 못했습니다. 다시 시도해 주세요.', status: 400 as const };
    }
  }
  const window = await requestPaysisPaymentWindow({
    mid: app.mid,
    mKey: app.apiKey,
    type: screen === 'M' ? 'M' : 'P',
    amount: String(row.amountKrw),
    productName: row.goodsName.slice(0, 20),
    userId: token.slice(0, 20),
    userName: (row.buyerName || '고객').slice(0, 20),
    orderNo,
    returnUrl: `${base}/api/public/card-payment/paysis-noti`,
    successUrl: `${base}/pay/paysis/ok`,
    failUrl: `${base}/pay/paysis/fail`,
    closeUrl: `${base}/pay/paysis/close`,
  });
  if (!window.ok) {
    await prisma.usageFeeCardPayment.updateMany({
      where: { id: row.id, status: 'PENDING', pgOrderId: orderNo, approvalNo: null },
      data: { pgOrderId: null, pgMid: null, payScreen: null },
    });
    return { error: window.message, status: 400 as const };
  }
  return { redirectUrl: window.redirectUrl };
}
