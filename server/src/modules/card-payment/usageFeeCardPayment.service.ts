import type { Prisma, UsageFeeCardPaymentPurpose } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { confirmPaymentForSchedulePeriod, getTenantBillingSchedule } from '../billing/tenantBilling.service.js';
import { kstYmdFromDate } from '../billing/tenantBilling.dates.js';
import { creditWalletFromCardOnce, reverseWalletCardOnce } from '../alimtalk/alimtalkWallet.service.js';
import { notifyPlatformOps } from '../platform/platformInboxNotify.service.js';
import { validateWalletChargeAmountKrw } from '../../lib/paymentTestAmount.js';
import { chargeUsageFeeKeyin, parseUsageFeeKeyinBody, type UsageFeeKeyinResult } from './cardPaymentUsageFeeKeyin.service.js';
import { paysisSha256, requestPaysisFullCancel, requestPaysisPaymentWindow } from './paysisWindow.adapter.js';
import { loadServiceBridgeMerchants } from './serviceBridgeWspay.js';
import { buildWspayOrderId } from './wspayOrderId.js';
import { instrumentKeyNames, monthsFromInstallmentCode, paidSourceFromScreen, readCardInstrument } from './cardInstrument.js';
import { splitTaxIncluded } from './cardVat.js';
import { serviceBridgePayNos } from './publicPayLink.service.js';

/** shared/tenantBilling.ts usageFeeVatKrw 와 동일 */
function usageFeeVatKrw(supplyKrw: number): number {
  if (!Number.isInteger(supplyKrw) || supplyKrw <= 0) return 0;
  return Math.round(supplyKrw * 0.1);
}

const OPEN_PERIOD = new Set(['DRAFT', 'ISSUED', 'OVERDUE', 'SCHEDULED']);
export const WALLET_CARD_GOODS_NAME = '청소비서 지갑';

/** 카드 취소는 됐지만 지갑·청구 반영이 끝나지 않은 건. 오늘 할 일에서 이 문구로 찾는다. */
export const USAGE_FEE_RECONCILE_MEMO = '반영 확인 필요';

export function walletFullCancelBlockedMessage(balanceKrw: number): string {
  const balance = Math.max(0, Math.trunc(balanceKrw)).toLocaleString('ko-KR');
  return `업체가 충전금 일부를 이미 사용해 전액 취소할 수 없습니다(잔액 ${balance}원). 원성 판매자센터에서 부분 환불 후 지갑 회수를 하세요`;
}

function isWalletPayment(row: { purpose: string; goodsName: string }): boolean {
  return row.purpose === 'OTHER' && row.goodsName === WALLET_CARD_GOODS_NAME;
}

export type UsageFeeOpenPeriod = {
  periodStartYmd: string;
  periodLabel: string;
  amountKrw: number;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  chargeAmountKrw: number;
  status: string;
};

function periodYmd(iso: string): string {
  return kstYmdFromDate(new Date(iso));
}

export async function listUsageFeeOpenPeriods(
  tenantId: string,
): Promise<{ error: string; status: 404 } | { items: UsageFeeOpenPeriod[] }> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return { error: '업체를 찾을 수 없습니다.', status: 404 };
  const collected = [];
  for (let offset = 0; offset < 300; offset += 100) {
    const page = await getTenantBillingSchedule(tenantId, { datePreset: 'all', limit: 100, offset });
    collected.push(...page.items);
    if (offset + 100 >= page.total) break;
  }
  const items = collected
    .filter((item) => item.amountKrw > 0 && OPEN_PERIOD.has(item.status))
    .map((item) => {
      const ymd = periodYmd(item.periodStart);
      const supplyAmountKrw = item.amountKrw;
      const vatAmountKrw = usageFeeVatKrw(supplyAmountKrw);
      return {
        periodStartYmd: ymd,
        periodLabel: ymd.slice(0, 7),
        amountKrw: supplyAmountKrw,
        supplyAmountKrw,
        vatAmountKrw,
        chargeAmountKrw: supplyAmountKrw + vatAmountKrw,
        status: item.status,
      };
    });
  return { items };
}

type PayLink =
  | { purpose: 'INVOICE'; tenantId: string; periodStartYmd: string }
  | { purpose: 'OTHER'; tenantId: string | null; memo: string }
  | { purpose: 'CLEANING_PROXY'; tenantId: string; inquiryId: string | null; memo: string };

function readLink(body: Record<string, unknown>): { error: string } | { link: PayLink } {
  const purpose =
    body.purpose === 'OTHER' ? 'OTHER' : body.purpose === 'INVOICE' ? 'INVOICE' : body.purpose === 'CLEANING_PROXY' ? 'CLEANING_PROXY' : '';
  if (!purpose) return { error: '결제 구분을 선택하세요.' };
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  const memo = typeof body.memo === 'string' ? body.memo.trim().slice(0, 500) : '';
  if (purpose === 'INVOICE') {
    const periodStartYmd = typeof body.periodStartYmd === 'string' ? body.periodStartYmd.trim() : '';
    if (!tenantId) return { error: '업체를 선택하세요.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStartYmd)) return { error: '결제할 달을 선택하세요.' };
    return { link: { purpose, tenantId, periodStartYmd } };
  }
  if (purpose === 'CLEANING_PROXY') {
    if (!tenantId) return { error: '청소한 업체를 선택하세요.' };
    const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId.trim() : '';
    return { link: { purpose, tenantId, inquiryId: inquiryId || null, memo } };
  }
  if (!memo) return { error: '기타 결제는 내용을 입력하세요.' };
  return { link: { purpose, tenantId: tenantId || null, memo } };
}

async function assertInvoiceAmount(
  link: Extract<PayLink, { purpose: 'INVOICE' }>,
  amountWon: number,
): Promise<{ error: string; status: 400 | 404 } | { period: UsageFeeOpenPeriod }> {
  const opened = await listUsageFeeOpenPeriods(link.tenantId);
  if ('error' in opened) return opened;
  const period = opened.items.find((item) => item.periodStartYmd === link.periodStartYmd);
  if (!period) return { error: '선택한 달은 아직 낼 이용료가 없습니다.', status: 400 as const };
  if (period.chargeAmountKrw !== amountWon) {
    return {
      error: `이 달 카드 결제 금액은 이용료 ${period.supplyAmountKrw.toLocaleString('ko-KR')}원과 부가세 ${period.vatAmountKrw.toLocaleString('ko-KR')}원을 더한 ${period.chargeAmountKrw.toLocaleString('ko-KR')}원입니다.`,
      status: 400 as const,
    };
  }
  return { period };
}

export async function payAndRecordUsageFee(
  body: unknown,
  platformUserId: string,
): Promise<{ error: string; status: 400 | 404 } | { result: UsageFeeKeyinResult & { invoiceApplied: boolean } }> {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const parsed = parseUsageFeeKeyinBody(raw);
  if ('error' in parsed) return { error: parsed.error, status: 400 };
  const linked = readLink(raw);
  if ('error' in linked) return { error: linked.error, status: 400 };

  const taxed = splitTaxIncluded(parsed.input.amountWon);
  let supplyAmountKrw = taxed.supplyKrw;
  let vatAmountKrw = taxed.vatKrw;
  if (linked.link.purpose === 'INVOICE') {
    const checked = await assertInvoiceAmount(linked.link, parsed.input.amountWon);
    if ('error' in checked) return { error: checked.error, status: checked.status ?? 400 };
    supplyAmountKrw = checked.period.supplyAmountKrw;
    vatAmountKrw = checked.period.vatAmountKrw;
  } else if (linked.link.tenantId) {
    const tenant = await prisma.tenant.findFirst({ where: { id: linked.link.tenantId }, select: { id: true } });
    if (!tenant) return { error: '업체를 찾을 수 없습니다.', status: 404 };
  }
  if (linked.link.purpose === 'CLEANING_PROXY' && linked.link.inquiryId) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: linked.link.inquiryId, tenantId: linked.link.tenantId },
      select: { id: true },
    });
    if (!inquiry) return { error: '접수를 찾을 수 없습니다.', status: 404 };
  }

  const charged = await chargeUsageFeeKeyin(parsed.input);
  if ('error' in charged) return charged;
  if (!charged.result.ok || !charged.result.orderNo) return { result: { ...charged.result, invoiceApplied: false } };

  let invoiceId: string | null = null;
  let invoiceApplied = false;
  let applyNote = '';
  if (linked.link.purpose === 'INVOICE') {
    try {
      const invoice = await confirmPaymentForSchedulePeriod(
        linked.link.tenantId,
        linked.link.periodStartYmd,
        platformUserId,
      );
      invoiceId = invoice.id;
      invoiceApplied = true;
    } catch (e) {
      applyNote = e instanceof Error ? e.message : '청구서에 반영하지 못했습니다.';
    }
  }

  const purpose: UsageFeeCardPaymentPurpose = linked.link.purpose;
  let recorded = true;
  try {
    await prisma.usageFeeCardPayment.create({
      data: {
        purpose,
        payMethod: 'KEYIN',
        status: 'APPROVED',
        tenantId: linked.link.tenantId,
        invoiceId,
        periodStart:
          linked.link.purpose === 'INVOICE' ? new Date(`${linked.link.periodStartYmd}T00:00:00+09:00`) : null,
        goodsName: parsed.input.goodsName,
        supplyAmountKrw,
        vatAmountKrw,
        amountKrw: parsed.input.amountWon,
        approvalNo: charged.result.approvalNo ?? null,
        pgOrderId: charged.result.orderNo,
        cardLast4: charged.result.cardLast4 ?? parsed.input.cardNo.slice(-4),
        installmentMonths: monthsFromInstallmentCode(parsed.input.installment),
        cardIssuer: charged.result.instrument?.cardIssuer ?? null,
        cardKind: charged.result.instrument?.cardKind ?? null,
        buyerName: parsed.input.buyerName,
        buyerPhone: parsed.input.buyerPhone || null,
        inquiryId: linked.link.purpose === 'CLEANING_PROXY' ? linked.link.inquiryId : null,
        memo:
          linked.link.purpose === 'INVOICE'
            ? applyNote || null
            : linked.link.memo || null,
        invoiceApplied,
        paidAt: new Date(),
        createdByPlatformUserId: platformUserId,
      },
    });
  } catch {
    recorded = false;
  }

  const parts = [charged.result.message];
  if (invoiceApplied) parts.push('이용료 청구에 반영했습니다.');
  else if (applyNote) parts.push(`승인은 되었으나 청구 반영은 되지 않았습니다. ${applyNote}`);
  if (!recorded) parts.push('승인 기록 저장에 실패했습니다. 같은 카드로 다시 결제하지 마세요.');
  const message = parts.join(' ');
  return { result: { ...charged.result, message, invoiceApplied } };
}

function linkRowClosed(row: { status: string; linkClosedAt: Date | null; linkExpiresAt: Date | null }): boolean {
  if (row.status !== 'PENDING') return false;
  if (row.linkClosedAt) return true;
  return Boolean(row.linkExpiresAt && row.linkExpiresAt.getTime() <= Date.now());
}

export function usageFeeStatusLabel(row: {
  status: string;
  linkClosedAt: Date | null;
  linkExpiresAt: Date | null;
}): string {
  if (row.status === 'APPROVED') return '결제 완료';
  if (row.status === 'CANCELLED') return '취소';
  if (row.status === 'FAILED') return '결제 실패';
  if (linkRowClosed(row)) return '링크 만료';
  return '결제 대기';
}

export function usageFeeMethodLabel(row: { payMethod: string; linkToken: string | null }): string {
  if (row.linkToken) return '링크';
  if (row.payMethod === 'KEYIN') return '수기';
  if (row.payMethod === 'BANK') return '통장';
  return '결제창';
}

export function usageFeePurposeLabel(purpose: string): string {
  if (purpose === 'INVOICE') return '이용료';
  if (purpose === 'CLEANING_PROXY') return '청소비 대신 받기';
  return '기타';
}

function maskPhone(raw: string | null): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export async function listUsageFeeCardPayments(
  limit: number,
  offset: number,
  payMethodRaw?: string,
  purposeRaw?: string,
  channelRaw?: string,
) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(offset, 0);
  const payMethod = payMethodRaw?.trim().toUpperCase() ?? '';
  const purpose = purposeRaw?.trim().toUpperCase() ?? '';
  const channel = channelRaw?.trim().toUpperCase() ?? '';
  const where: Prisma.UsageFeeCardPaymentWhereInput = {
    OR: [{ status: 'APPROVED' }, { status: 'CANCELLED' }, { status: 'PENDING', payMethod: 'PAY_WINDOW' }],
  };
  if (channel === 'LINK') where.linkToken = { not: null };
  else if (channel === 'KEYIN') where.payMethod = 'KEYIN';
  else if (payMethod === 'CARD') where.payMethod = { in: ['KEYIN', 'PAY_WINDOW'] };
  else if (payMethod === 'BANK' || payMethod === 'KEYIN' || payMethod === 'PAY_WINDOW') {
    where.payMethod = payMethod;
  }
  if (purpose === 'INVOICE' || purpose === 'OTHER' || purpose === 'CLEANING_PROXY') {
    where.purpose = purpose;
  }
  const [rows, total] = await Promise.all([
    prisma.usageFeeCardPayment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      skip,
      take,
      include: { tenant: { select: { name: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.usageFeeCardPayment.count({ where }),
  ]);
  const walletTenantIds = [
    ...new Set(
      rows
        .filter((row) => isWalletPayment(row) && row.invoiceApplied && row.tenantId && isSameDayCardCancel(row))
        .map((row) => row.tenantId as string),
    ),
  ];
  const wallets =
    walletTenantIds.length === 0
      ? []
      : await prisma.tenantAlimtalkWallet.findMany({
          where: { tenantId: { in: walletTenantIds } },
          select: { tenantId: true, prepaidBalanceKrw: true },
        });
  const balanceByTenant = new Map(wallets.map((wallet) => [wallet.tenantId, wallet.prepaidBalanceKrw]));
  const inquiryIds = [...new Set(rows.map((row) => row.inquiryId).filter((id): id is string => Boolean(id)))];
  const inquiries =
    inquiryIds.length === 0
      ? []
      : await prisma.inquiry.findMany({
          where: { id: { in: inquiryIds } },
          select: { id: true, inquiryNumber: true, customerName: true, preferredDate: true, address: true },
        });
  const inquiryLabel = new Map(
    inquiries.map((inquiry) => {
      const ymd = inquiry.preferredDate ? kstYmdFromDate(inquiry.preferredDate) : '';
      const day = ymd ? `${ymd.slice(5, 7)}.${ymd.slice(8, 10)}` : '';
      const place = inquiry.address.split(/\s+/).slice(0, 2).join(' ');
      return [inquiry.id, [day, inquiry.customerName, place].filter(Boolean).join(' · ')] as const;
    }),
  );
  const payNos = await serviceBridgePayNos(rows);
  return {
    total,
    items: rows.map((row) => {
      const statusLabel = usageFeeStatusLabel(row);
      const copyable = Boolean(row.linkToken) && statusLabel === '결제 대기';
      return {
        id: row.id,
        purpose: row.purpose,
        purposeLabel: usageFeePurposeLabel(row.purpose),
        payMethod: row.payMethod,
        methodLabel: usageFeeMethodLabel(row),
        status: row.status,
        statusLabel,
        cancelable: isSameDayCardCancel(row),
        tenantName: row.tenant?.name ?? null,
        inquiryLabel: row.inquiryId ? inquiryLabel.get(row.inquiryId) ?? null : null,
        inquiryNumber: row.inquiryId ? inquiries.find((item) => item.id === row.inquiryId)?.inquiryNumber ?? null : null,
        payNo: payNos.get(row.id) ?? null,
        installmentMonths: row.installmentMonths,
        cardIssuer: row.cardIssuer,
        cardKind: row.cardKind,
        paidSource: row.paidSource,
        customerPhoneMasked: maskPhone(row.buyerPhone),
        createdAt: row.createdAt.toISOString(),
        linkClosedAt: row.linkClosedAt?.toISOString() ?? null,
        createdByName: row.createdBy?.name ?? null,
        periodStart: row.periodStart?.toISOString() ?? null,
        goodsName: row.goodsName,
        supplyAmountKrw: row.supplyAmountKrw,
        vatAmountKrw: row.vatAmountKrw,
        amountKrw: row.amountKrw,
        approvalNo: row.approvalNo,
        cardLast4: row.cardLast4,
        buyerName: row.buyerName,
        buyerPhone: null,
        memo: row.memo,
        linkUrl: copyable && row.linkToken ? `${getPublicAppBaseUrl()}/pay/sb/${row.linkToken}` : null,
        linkExpiresAt: row.linkExpiresAt?.toISOString() ?? null,
        invoiceApplied: row.invoiceApplied,
        paidAt: row.paidAt.toISOString(),
        needsReconcile: row.status === 'CANCELLED' && row.memo === USAGE_FEE_RECONCILE_MEMO,
        cancelBlockReason: walletCancelBlockReason(row, balanceByTenant),
      };
    }),
  };
}

function walletCancelBlockReason(
  row: { purpose: string; goodsName: string; invoiceApplied: boolean; tenantId: string | null; supplyAmountKrw: number; status: string; payMethod: string; paidAt: Date; pgOrderId: string | null; pgMid: string | null },
  balanceByTenant: Map<string, number>,
): string | null {
  if (!isWalletPayment(row) || !row.invoiceApplied || !row.tenantId || !isSameDayCardCancel(row)) return null;
  const balance = balanceByTenant.get(row.tenantId) ?? 0;
  if (balance >= row.supplyAmountKrw) return null;
  return walletFullCancelBlockedMessage(balance);
}

function toPeriodYmd(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return '';
  return kstYmdFromDate(date);
}

/** 업체 관리자가 이용료를 통합결제창으로 연다. 승인 통보가 오면 청구에 반영한다. */
export async function openTenantUsageFeeWindow(
  tenantId: string,
  periodStartRaw: string,
): Promise<
  | { error: string; status: 400 | 404 }
  | { result: { redirectUrl: string; supplyAmountKrw: number; vatAmountKrw: number; chargeAmountKrw: number } }
> {
  const periodStartYmd = toPeriodYmd(periodStartRaw);
  if (!periodStartYmd) return { error: '결제할 달을 선택하세요.', status: 400 };
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) return { error: '업체를 찾을 수 없습니다.', status: 404 };
  const opened = await listUsageFeeOpenPeriods(tenantId);
  if ('error' in opened) return opened;
  const period = opened.items.find((item) => item.periodStartYmd === periodStartYmd);
  if (!period) return { error: '선택한 달은 아직 낼 이용료가 없습니다.', status: 400 };

  const app = (await loadServiceBridgeMerchants()).appCard;
  if (!app) return { error: '이용료 결제창 키가 서버에 없습니다.', status: 400 };
  const orderNo = buildWspayOrderId(app.oid, `win${Date.now().toString(36)}`)?.slice(0, 30);
  if (!orderNo) return { error: '주문번호를 만들지 못했습니다.', status: 400 };
  const base = getPublicAppBaseUrl();
  const pending = await prisma.usageFeeCardPayment.create({
    data: {
      purpose: 'INVOICE',
      payMethod: 'PAY_WINDOW',
      status: 'PENDING',
      tenantId,
      periodStart: new Date(`${periodStartYmd}T00:00:00+09:00`),
      goodsName: `솔루션 이용료 ${period.periodLabel}`.slice(0, 80),
      supplyAmountKrw: period.supplyAmountKrw,
      vatAmountKrw: period.vatAmountKrw,
      amountKrw: period.chargeAmountKrw,
      pgOrderId: orderNo,
      pgMid: app.mid,
      payScreen: 'P',
      paidSource: paidSourceFromScreen('P'),
      buyerName: tenant.name.slice(0, 40),
      invoiceApplied: false,
      paidAt: new Date(),
    },
  });
  const window = await requestPaysisPaymentWindow({
    mid: app.mid,
    mKey: app.apiKey,
    type: 'P',
    amount: String(period.chargeAmountKrw),
    productName: `이용료${period.periodLabel.replace('-', '')}`.slice(0, 20),
    userId: tenantId.replace(/-/g, '').slice(0, 20),
    userName: tenant.name.slice(0, 20) || '업체',
    orderNo,
    returnUrl: `${base}/api/public/card-payment/paysis-noti`,
    successUrl: `${base}/pay/paysis/ok`,
    failUrl: `${base}/pay/paysis/fail`,
    closeUrl: `${base}/pay/paysis/close`,
  });
  if (!window.ok) {
    await prisma.usageFeeCardPayment.deleteMany({ where: { id: pending.id, tenantId } });
    return { error: window.message, status: 400 };
  }
  return {
    result: {
      redirectUrl: window.redirectUrl,
      supplyAmountKrw: period.supplyAmountKrw,
      vatAmountKrw: period.vatAmountKrw,
      chargeAmountKrw: period.chargeAmountKrw,
    },
  };
}

/** 업체 관리자가 청소비서 지갑을 같은 이용료 결제창으로 충전한다. 승인 통지가 오기 전에는 잔액이 안 변한다. */
export async function openTenantWalletWindow(
  tenantId: string,
  amountKrw: number,
): Promise<{ error: string; status: 400 | 404 } | { result: { redirectUrl: string; amountKrw: number } }> {
  const invalid = validateWalletChargeAmountKrw(amountKrw);
  if (invalid) return { error: invalid, status: 400 };
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) return { error: '업체를 찾을 수 없습니다.', status: 404 };
  const app = (await loadServiceBridgeMerchants()).appCard;
  if (!app) return { error: '이용료 결제창 키가 서버에 없습니다.', status: 400 };
  const orderNo = buildWspayOrderId(app.oid, `wal${Date.now().toString(36)}`)?.slice(0, 30);
  if (!orderNo) return { error: '주문번호를 만들지 못했습니다.', status: 400 };
  const base = getPublicAppBaseUrl();
  const pending = await prisma.usageFeeCardPayment.create({
    data: {
      purpose: 'OTHER',
      payMethod: 'PAY_WINDOW',
      status: 'PENDING',
      tenantId,
      goodsName: WALLET_CARD_GOODS_NAME,
      supplyAmountKrw: splitTaxIncluded(amountKrw).supplyKrw,
      vatAmountKrw: splitTaxIncluded(amountKrw).vatKrw,
      amountKrw,
      pgOrderId: orderNo,
      pgMid: app.mid,
      payScreen: 'P',
      paidSource: paidSourceFromScreen('P'),
      buyerName: tenant.name.slice(0, 40),
      memo: 'wallet',
      invoiceApplied: false,
      paidAt: new Date(),
    },
  });
  const window = await requestPaysisPaymentWindow({
    mid: app.mid,
    mKey: app.apiKey,
    type: 'P',
    amount: String(amountKrw),
    productName: '지갑충전',
    userId: tenantId.replace(/-/g, '').slice(0, 20),
    userName: tenant.name.slice(0, 20) || '업체',
    orderNo,
    returnUrl: `${base}/api/public/card-payment/paysis-noti`,
    successUrl: `${base}/pay/paysis/ok`,
    failUrl: `${base}/pay/paysis/fail`,
    closeUrl: `${base}/pay/paysis/close`,
  });
  if (!window.ok) {
    await prisma.usageFeeCardPayment.deleteMany({ where: { id: pending.id, tenantId } });
    return { error: window.message, status: 400 };
  }
  return { result: { redirectUrl: window.redirectUrl, amountKrw } };
}

function isSameDayCardCancel(row: { status: string; payMethod: string; paidAt: Date; pgOrderId: string | null; pgMid: string | null }): boolean {
  if (row.status !== 'APPROVED') return false;
  if (kstYmdFromDate(row.paidAt) !== kstYmdFromDate(new Date())) return false;
  if (row.payMethod === 'KEYIN') return true;
  return row.payMethod === 'PAY_WINDOW' && Boolean(row.pgOrderId && row.pgMid);
}

async function reopenInvoiceAfterCardCancel(invoiceId: string, tenantId: string) {
  await prisma.tenantInvoice.updateMany({
    where: { id: invoiceId, tenantId, status: 'PAID' },
    data: { status: 'ISSUED', paidAt: null, confirmedAt: null, confirmedByPlatformUserId: null },
  });
  await prisma.platformReferrerCommissionAccrual.updateMany({
    where: { invoiceId, tenantId, status: 'PENDING' },
    data: { status: 'REVERSED' },
  });
}

async function markUsageFeeCancelled(row: {
  id: string;
  invoiceId: string | null;
  invoiceApplied: boolean;
  tenantId: string | null;
  purpose: string;
  goodsName: string;
  supplyAmountKrw: number;
  pgOrderId: string | null;
}) {
  const updated = await prisma.usageFeeCardPayment.updateMany({
    where: { id: row.id, status: 'APPROVED' },
    data: { status: 'CANCELLED', memo: '당일 전액 취소' },
  });
  if (updated.count === 0) return;
  try {
    if (isWalletPayment(row) && row.invoiceApplied && row.tenantId && row.pgOrderId) {
      await reverseWalletCardOnce({
        tenantId: row.tenantId,
        amountKrw: row.supplyAmountKrw,
        pgOrderId: row.pgOrderId,
      });
    } else if (row.invoiceApplied && row.invoiceId && row.tenantId) {
      await reopenInvoiceAfterCardCancel(row.invoiceId, row.tenantId);
    }
    await prisma.usageFeeCardPayment.updateMany({
      where: { id: row.id, status: 'CANCELLED' },
      data: { invoiceApplied: false },
    });
  } catch (err) {
    await flagUsageFeeReconcile(row);
    throw err;
  }
}

async function flagUsageFeeReconcile(row: { id: string; tenantId: string | null }): Promise<void> {
  await prisma.usageFeeCardPayment.updateMany({
    where: { id: row.id, status: 'CANCELLED' },
    data: { memo: USAGE_FEE_RECONCILE_MEMO },
  });
  if (!row.tenantId) return;
  await notifyPlatformOps({
    event: 'payment_confirm',
    tenantId: row.tenantId,
    title: '반영 확인 필요',
    body: '카드 취소는 됐지만 지갑 또는 이용료 청구 반영을 확인해야 합니다.',
    email: false,
  }).catch((err) => {
    console.error('[usage-fee reconcile notify]', err);
  });
}

/** 정산의 당일 전액 취소. 결제창만 페이시스로 취소한다. 수기는 판매자센터다. */
export async function cancelUsageFeeCardPayment(
  id: string,
): Promise<{ error: string; status: 400 | 404 } | { ok: true; needsReconcile?: boolean; message?: string }> {
  const row = await prisma.usageFeeCardPayment.findFirst({ where: { id } });
  if (!row) return { error: '정산 기록을 찾을 수 없습니다.', status: 404 };
  if (!isSameDayCardCancel(row)) return { error: '결제 당일에만 전액 취소할 수 있습니다.', status: 400 };
  if (row.payMethod === 'KEYIN') {
    return { error: '수기 승인은 원성 판매자센터에서 당일 전액 취소합니다.', status: 400 };
  }
  if (row.payMethod !== 'PAY_WINDOW' || !row.pgOrderId || !row.pgMid) {
    return { error: '주문번호가 없어 취소할 수 없습니다.', status: 400 };
  }
  if (isWalletPayment(row) && row.invoiceApplied && row.tenantId) {
    const wallet = await prisma.tenantAlimtalkWallet.findUnique({
      where: { tenantId: row.tenantId },
      select: { prepaidBalanceKrw: true },
    });
    const balance = wallet?.prepaidBalanceKrw ?? 0;
    if (balance < row.supplyAmountKrw) {
      return { error: walletFullCancelBlockedMessage(balance), status: 400 };
    }
  }
  const cancelled = await requestPaysisFullCancel({
    mid: row.pgMid,
    ordNo: row.pgOrderId,
    canNm: '플랫폼',
    canMsg: '이용료전액취소',
    canAmt: String(row.amountKrw),
  });
  if (cancelled.ok) {
    try {
      await markUsageFeeCancelled(row);
    } catch (err) {
      console.error('[usage-fee cancel apply]', err);
      return {
        ok: true,
        needsReconcile: true,
        message: '카드는 취소됐지만 잔액·청구 반영을 확인해야 합니다. 오늘 할 일 「돈 처리」에 올려 두었습니다.',
      };
    }
  }
  if (!cancelled.ok) return { error: cancelled.message, status: 400 };
  return { ok: true };
}

/** 페이시스 취소 통보. 해시가 없는 당일 전액 취소 결과다. */
export async function applyUsageFeePaysisCancel(rec: Record<string, unknown>): Promise<'SUCCESS' | 'FAIL' | null> {
  const orderNo = String(rec.orderNo ?? '').trim();
  const amount = String(rec.amount ?? '').trim();
  if (!orderNo) return null;
  const row = await prisma.usageFeeCardPayment.findFirst({ where: { pgOrderId: orderNo } });
  if (!row) return null;
  if (amount && Number(amount) !== row.amountKrw) return 'FAIL';
  if (row.status === 'CANCELLED') return 'SUCCESS';
  if (row.status !== 'APPROVED') return 'FAIL';
  try {
    await markUsageFeeCancelled(row);
  } catch (err) {
    console.error('[usage-fee cancel]', err);
    return 'FAIL';
  }
  return 'SUCCESS';
}

async function applyUsageFeeSideEffect(row: {
  purpose: string;
  goodsName: string;
  tenantId: string | null;
  periodStart: Date | null;
  supplyAmountKrw: number;
  pgOrderId: string | null;
  invoiceId: string | null;
}): Promise<{ invoiceId: string | null; invoiceApplied: boolean }> {
  if (isWalletPayment(row)) {
    if (!row.tenantId || !row.pgOrderId) throw new Error('지갑 결제 정보가 없습니다.');
    await creditWalletFromCardOnce({
      tenantId: row.tenantId,
      amountKrw: row.supplyAmountKrw,
      pgOrderId: row.pgOrderId,
    });
    return { invoiceId: null, invoiceApplied: true };
  }
  if (row.purpose === 'INVOICE' && row.tenantId && row.periodStart) {
    try {
      const invoice = await confirmPaymentForSchedulePeriod(row.tenantId, kstYmdFromDate(row.periodStart), '');
      return { invoiceId: invoice.id, invoiceApplied: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (!message.includes('이미')) throw err;
      const invoice = await prisma.tenantInvoice.findFirst({
        where: { tenantId: row.tenantId, status: 'PAID', periodStart: row.periodStart },
        select: { id: true },
      });
      return { invoiceId: invoice?.id ?? row.invoiceId, invoiceApplied: true };
    }
  }
  return { invoiceId: row.invoiceId, invoiceApplied: true };
}

/** 페이시스 승인 통보. 이용료는 청구를 납부 처리하고, 지갑은 잔액을 올린다. 같은 통지는 한 번만 반영한다. */
export async function applyUsageFeePaysisNotification(
  rec: Record<string, unknown>,
): Promise<'SUCCESS' | 'FAIL' | null> {
  const orderNo = String(rec.orderNo ?? '').trim();
  const amount = String(rec.amount ?? '').trim();
  const givenHash = String(rec.hashValue ?? '').trim().toLowerCase();
  if (!orderNo) return null;
  const row = await prisma.usageFeeCardPayment.findFirst({ where: { pgOrderId: orderNo } });
  if (!row) return null;
  if (!row.pgMid || !row.payScreen || !amount || !givenHash) return 'FAIL';
  if (Number(amount) !== row.amountKrw) return 'FAIL';
  const expected = paysisSha256([row.pgMid, row.payScreen, orderNo, amount]);
  if (expected !== givenHash) return 'FAIL';
  if (row.status === 'CANCELLED' || row.status === 'FAILED') return 'FAIL';
  console.info('[card-instrument] usage-fee paysis keys', instrumentKeyNames(rec).join(','));
  const instrument = readCardInstrument(rec);
  if (row.status === 'APPROVED' && row.invoiceApplied) return 'SUCCESS';

  const masked = String(rec.cardNo ?? '');
  const last4 = masked.replace(/\D/g, '').slice(-4);
  const approvalNo = String(rec.authNo ?? '').slice(0, 32);
  let ownedClaim = false;
  if (row.status === 'PENDING') {
    const claimed = await prisma.usageFeeCardPayment.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        approvalNo: approvalNo || null,
        cardLast4: last4.length === 4 ? last4 : null,
        cardIssuer: instrument.cardIssuer,
        installmentMonths: instrument.installmentMonths,
        cardKind: instrument.cardKind,
        paidSource: row.paidSource ?? paidSourceFromScreen(row.payScreen),
        paidAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      const again = await prisma.usageFeeCardPayment.findFirst({ where: { id: row.id } });
      if (again?.status === 'APPROVED' && again.invoiceApplied) return 'SUCCESS';
      return 'FAIL';
    }
    ownedClaim = true;
  }

  try {
    const applied = await applyUsageFeeSideEffect(row);
    await prisma.usageFeeCardPayment.updateMany({
      where: { id: row.id, status: 'APPROVED', invoiceApplied: false },
      data: { invoiceId: applied.invoiceId, invoiceApplied: applied.invoiceApplied },
    });
    return 'SUCCESS';
  } catch (err) {
    console.error('[usage-fee noti]', err);
    if (ownedClaim) {
      await prisma.usageFeeCardPayment.updateMany({
        where: { id: row.id, status: 'APPROVED', invoiceApplied: false },
        data: { status: 'PENDING', approvalNo: null, cardLast4: null },
      });
    }
    return 'FAIL';
  }
}

/** 플랫폼 입금 확인은 통장 입금으로 기록한다. 같은 청구에 통장 기록이 있으면 다시 만들지 않는다. */
export async function recordBankUsageFeeSettlement(invoiceId: string, platformUserId: string | null) {
  const invoice = await prisma.tenantInvoice.findFirst({
    where: { id: invoiceId, status: 'PAID' },
  });
  if (!invoice) return;
  const existing = await prisma.usageFeeCardPayment.findFirst({
    where: { invoiceId, payMethod: 'BANK', status: 'APPROVED' },
    select: { id: true },
  });
  if (existing) return;
  const supplyAmountKrw = invoice.amountKrw;
  const vatAmountKrw = usageFeeVatKrw(supplyAmountKrw);
  await prisma.usageFeeCardPayment.create({
    data: {
      purpose: 'INVOICE',
      payMethod: 'BANK',
      status: 'APPROVED',
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      periodStart: invoice.periodStart,
      goodsName: '솔루션 이용료 통장입금',
      supplyAmountKrw,
      vatAmountKrw,
      amountKrw: supplyAmountKrw + vatAmountKrw,
      invoiceApplied: true,
      paidAt: invoice.paidAt ?? new Date(),
      createdByPlatformUserId: platformUserId,
    },
  });
}
