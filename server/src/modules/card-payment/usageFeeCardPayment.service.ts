import type { Prisma, UsageFeeCardPaymentPurpose } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { confirmPaymentForSchedulePeriod, getTenantBillingSchedule } from '../billing/tenantBilling.service.js';
import { kstYmdFromDate } from '../billing/tenantBilling.dates.js';
import { chargeUsageFeeKeyin, parseUsageFeeKeyinBody, type UsageFeeKeyinResult } from './cardPaymentUsageFeeKeyin.service.js';
import { paysisSha256, requestPaysisPaymentWindow } from './paysisWindow.adapter.js';
import { loadServiceBridgeMerchants } from './serviceBridgeWspay.js';
import { buildWspayOrderId } from './wspayOrderId.js';

/** shared/tenantBilling.ts usageFeeVatKrw 와 동일 */
function usageFeeVatKrw(supplyKrw: number): number {
  if (!Number.isInteger(supplyKrw) || supplyKrw <= 0) return 0;
  return Math.round(supplyKrw * 0.1);
}

const OPEN_PERIOD = new Set(['DRAFT', 'ISSUED', 'OVERDUE', 'SCHEDULED']);

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
  | { purpose: 'OTHER'; tenantId: string | null; memo: string };

function readLink(body: Record<string, unknown>): { error: string } | { link: PayLink } {
  const purpose = body.purpose === 'OTHER' ? 'OTHER' : body.purpose === 'INVOICE' ? 'INVOICE' : '';
  if (!purpose) return { error: '결제 구분을 선택하세요.' };
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  if (purpose === 'INVOICE') {
    const periodStartYmd = typeof body.periodStartYmd === 'string' ? body.periodStartYmd.trim() : '';
    if (!tenantId) return { error: '업체를 선택하세요.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStartYmd)) return { error: '결제할 달을 선택하세요.' };
    return { link: { purpose, tenantId, periodStartYmd } };
  }
  const memo = typeof body.memo === 'string' ? body.memo.trim().slice(0, 200) : '';
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

  let supplyAmountKrw = parsed.input.amountWon;
  let vatAmountKrw = 0;
  if (linked.link.purpose === 'INVOICE') {
    const checked = await assertInvoiceAmount(linked.link, parsed.input.amountWon);
    if ('error' in checked) return { error: checked.error, status: checked.status ?? 400 };
    supplyAmountKrw = checked.period.supplyAmountKrw;
    vatAmountKrw = checked.period.vatAmountKrw;
  } else if (linked.link.tenantId) {
    const tenant = await prisma.tenant.findFirst({ where: { id: linked.link.tenantId }, select: { id: true } });
    if (!tenant) return { error: '업체를 찾을 수 없습니다.', status: 404 };
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
        buyerName: parsed.input.buyerName,
        memo: linked.link.purpose === 'OTHER' ? linked.link.memo : applyNote || null,
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

export async function listUsageFeeCardPayments(limit: number, offset: number, payMethodRaw?: string) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(offset, 0);
  const payMethod = payMethodRaw?.trim().toUpperCase() ?? '';
  const where: Prisma.UsageFeeCardPaymentWhereInput = {
    OR: [{ status: 'APPROVED' }, { status: 'PENDING', payMethod: 'PAY_WINDOW' }],
  };
  if (payMethod === 'CARD') where.payMethod = { in: ['KEYIN', 'PAY_WINDOW'] };
  else if (payMethod === 'BANK' || payMethod === 'KEYIN' || payMethod === 'PAY_WINDOW') {
    where.payMethod = payMethod;
  }
  const [rows, total] = await Promise.all([
    prisma.usageFeeCardPayment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      skip,
      take,
      include: { tenant: { select: { name: true } } },
    }),
    prisma.usageFeeCardPayment.count({ where }),
  ]);
  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      purpose: row.purpose,
      payMethod: row.payMethod,
      status: row.status,
      tenantName: row.tenant?.name ?? null,
      periodStart: row.periodStart?.toISOString() ?? null,
      goodsName: row.goodsName,
      supplyAmountKrw: row.supplyAmountKrw,
      vatAmountKrw: row.vatAmountKrw,
      amountKrw: row.amountKrw,
      approvalNo: row.approvalNo,
      cardLast4: row.cardLast4,
      buyerName: row.buyerName,
      memo: row.memo,
      invoiceApplied: row.invoiceApplied,
      paidAt: row.paidAt.toISOString(),
    })),
  };
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

  const app = loadServiceBridgeMerchants().appCard;
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

/** 페이시스 승인 통보. 이용료 주문이면 청구를 납부 처리한다. */
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
  if (row.status === 'APPROVED') return 'SUCCESS';

  let invoiceId: string | null = null;
  let invoiceApplied = false;
  let applyNote = '';
  if (row.purpose === 'INVOICE' && row.tenantId && row.periodStart) {
    try {
      const invoice = await confirmPaymentForSchedulePeriod(row.tenantId, kstYmdFromDate(row.periodStart), '');
      invoiceId = invoice.id;
      invoiceApplied = true;
    } catch (e) {
      applyNote = e instanceof Error ? e.message : '청구서에 반영하지 못했습니다.';
    }
  }
  const masked = String(rec.cardNo ?? '');
  const last4 = masked.replace(/\D/g, '').slice(-4);
  const approvalNo = String(rec.authNo ?? '').slice(0, 32);
  await prisma.usageFeeCardPayment.updateMany({
    where: { id: row.id, status: 'PENDING' },
    data: {
      status: 'APPROVED',
      invoiceId,
      invoiceApplied,
      approvalNo: approvalNo || null,
      cardLast4: last4.length === 4 ? last4 : null,
      paidAt: new Date(),
      memo: applyNote || null,
    },
  });
  return 'SUCCESS';
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
