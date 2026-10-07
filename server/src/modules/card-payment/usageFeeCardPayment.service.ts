import type { UsageFeeCardPaymentPurpose } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { confirmPaymentForSchedulePeriod, getTenantBillingSchedule } from '../billing/tenantBilling.service.js';
import { kstYmdFromDate } from '../billing/tenantBilling.dates.js';
import { chargeUsageFeeKeyin, parseUsageFeeKeyinBody, type UsageFeeKeyinResult } from './cardPaymentUsageFeeKeyin.service.js';

const OPEN_PERIOD = new Set(['DRAFT', 'ISSUED', 'OVERDUE', 'SCHEDULED']);

export type UsageFeeOpenPeriod = {
  periodStartYmd: string;
  periodLabel: string;
  amountKrw: number;
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
      return {
        periodStartYmd: ymd,
        periodLabel: ymd.slice(0, 7),
        amountKrw: item.amountKrw,
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
  if (period.amountKrw !== amountWon) {
    return { error: `이 달 이용료는 ${period.amountKrw.toLocaleString('ko-KR')}원입니다.`, status: 400 as const };
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

  if (linked.link.purpose === 'INVOICE') {
    const checked = await assertInvoiceAmount(linked.link, parsed.input.amountWon);
    if ('error' in checked) return { error: checked.error, status: checked.status ?? 400 };
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
        tenantId: linked.link.tenantId,
        invoiceId,
        periodStart:
          linked.link.purpose === 'INVOICE' ? new Date(`${linked.link.periodStartYmd}T00:00:00+09:00`) : null,
        goodsName: parsed.input.goodsName,
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

export async function listUsageFeeCardPayments(limit: number, offset: number) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(offset, 0);
  const [rows, total] = await Promise.all([
    prisma.usageFeeCardPayment.findMany({
      orderBy: { paidAt: 'desc' },
      skip,
      take,
      include: { tenant: { select: { name: true } } },
    }),
    prisma.usageFeeCardPayment.count(),
  ]);
  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      purpose: row.purpose,
      tenantName: row.tenant?.name ?? null,
      periodStart: row.periodStart?.toISOString() ?? null,
      goodsName: row.goodsName,
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
