import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import { notifyPlatformOps } from '../platform/platformInboxNotify.service.js';
import { cancelCustomerLinkPayment } from './cardPaymentCancel.service.js';
import { readSellerCenterLogin } from './cardPaymentSellerCenter.service.js';

function kstYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

function kstStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+09:00`);
}

function addDays(ymd: string, days: number): string {
  const date = kstStart(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return kstYmd(date);
}

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function maskPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function bpsLabel(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export type TenantPayQuery = {
  period?: string;
  from?: string;
  to?: string;
  tenantId?: string;
  method?: string;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

function rangeOf(query: TenantPayQuery): { gte: Date; lt: Date } {
  const today = kstYmd();
  if (query.period === 'custom' && query.from && query.to) {
    const from = query.from <= query.to ? query.from : query.to;
    const to = query.from <= query.to ? query.to : query.from;
    return { gte: kstStart(from), lt: kstStart(addDays(to, 1)) };
  }
  if (query.period === '7d') return { gte: kstStart(addDays(today, -6)), lt: kstStart(addDays(today, 1)) };
  if (query.period === 'today') return { gte: kstStart(today), lt: kstStart(addDays(today, 1)) };
  return { gte: kstStart(monthStart(today)), lt: kstStart(addDays(today, 1)) };
}

function whereOf(query: TenantPayQuery): Prisma.CardPaymentWhereInput {
  const range = rangeOf(query);
  const q = query.q?.trim() ?? '';
  const where: Prisma.CardPaymentWhereInput = {
    paidAt: range,
    status: { in: ['APPROVED', 'CANCELLED'] },
  };
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.method === 'KEYIN' || query.method === 'CUSTOMER_LINK') where.method = query.method;
  if (query.status === 'APPROVED' || query.status === 'CANCELLED') where.status = query.status;
  if (query.status === 'REQUEST') where.cancelRequests = { some: { status: 'PENDING' } };
  if (q) {
    const or: Prisma.CardPaymentWhereInput[] = [
      { customerName: { contains: q, mode: 'insensitive' } },
      { approvalNo: { contains: q } },
    ];
    if (/^\d{4}$/.test(q)) or.push({ cardLast4: q });
    where.OR = or;
  }
  return where;
}

const LIST_INCLUDE = {
  tenant: { select: { id: true, name: true } },
  inquiry: { select: { operatingCompany: { select: { name: true } } } },
  cancelRequests: { where: { status: 'PENDING' }, select: { id: true }, take: 1 },
} satisfies Prisma.CardPaymentInclude;

function rowView(row: Prisma.CardPaymentGetPayload<{ include: typeof LIST_INCLUDE }>) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    merchantName: row.tenant.name,
    brandName: row.inquiry?.operatingCompany?.name || '기본 브랜드',
    customerName: row.customerName,
    amountWon: row.amountWon,
    installmentMonths: row.installmentMonths,
    cardIssuer: row.cardIssuer,
    cardLast4: row.cardLast4,
    cardKind: row.cardKind,
    method: row.method,
    paidSource: row.paidSource,
    status: row.status,
    cancelRequested: row.cancelRequests.length > 0,
    paidAt: row.paidAt?.toISOString() ?? null,
    approvalNo: row.approvalNo,
  };
}

export async function listPlatformTenantPayments(query: TenantPayQuery) {
  const where = whereOf(query);
  const limit = Math.min(100, Math.max(1, query.limit ?? 30));
  const offset = Math.max(0, query.offset ?? 0);
  const [rows, total, approved, cancelled, merchants] = await Promise.all([
    prisma.cardPayment.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: { paidAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.cardPayment.count({ where }),
    prisma.cardPayment.aggregate({
      where: { ...where, status: 'APPROVED' },
      _count: true,
      _sum: { amountWon: true, tenantNetWon: true, platformSpreadWon: true },
    }),
    prisma.cardPayment.aggregate({
      where: { ...where, status: 'CANCELLED' },
      _count: true,
      _sum: { amountWon: true },
    }),
    prisma.tenant.findMany({
      where: { cardPayments: { some: { status: { in: ['APPROVED', 'CANCELLED'] } } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);
  return {
    items: rows.map(rowView),
    total,
    limit,
    offset,
    merchants,
    summary: {
      approvedCount: approved._count,
      approvedAmountWon: approved._sum.amountWon ?? 0,
      cancelledCount: cancelled._count,
      cancelledAmountWon: cancelled._sum.amountWon ?? 0,
      tenantNetWon: approved._sum.tenantNetWon ?? 0,
      platformSpreadWon: approved._sum.platformSpreadWon ?? 0,
    },
  };
}

export async function getPlatformTenantPayment(id: string) {
  const row = await prisma.cardPayment.findFirst({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true } },
      inquiry: {
        select: {
          id: true,
          inquiryNumber: true,
          customerPhone: true,
          operatingCompany: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
      cancelRequests: {
        orderBy: { requestedAt: 'asc' },
        include: {
          requestedBy: { select: { name: true } },
          decidedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!row || (row.status !== 'APPROVED' && row.status !== 'CANCELLED')) return null;
  const sameDay = row.paidAt != null && kstYmd(row.paidAt) === kstYmd();
  return {
    ...rowView({ ...row, cancelRequests: row.cancelRequests.filter((item) => item.status === 'PENDING') }),
    pgOrderId: row.pgOrderId,
    pgMidTail: row.pgMid ? row.pgMid.slice(-4) : null,
    inquiryId: row.inquiryId,
    inquiryNumber: row.inquiry?.inquiryNumber ?? row.inquiryNumber,
    customerPhoneMasked: row.customerPhoneMasked || maskPhone(row.inquiry?.customerPhone),
    tenantFeeBps: row.tenantFeeBps,
    tenantFeeLabel: `${bpsLabel(row.tenantFeeBps)} · ${row.tenantFeeWon.toLocaleString('ko-KR')}원`,
    platformCostLabel: `${bpsLabel(row.platformCostBps)} · ${row.platformCostWon.toLocaleString('ko-KR')}원`,
    platformSpreadWon: row.platformSpreadWon,
    tenantNetWon: row.tenantNetWon,
    canApiCancel: row.method === 'CUSTOMER_LINK' && row.status === 'APPROVED' && sameDay,
    history: [
      { label: '결제 생성', at: row.createdAt.toISOString(), who: row.createdBy?.name ?? '', note: '' },
      ...(row.paidAt ? [{ label: '승인', at: row.paidAt.toISOString(), who: '', note: row.approvalNo ?? '' }] : []),
      ...row.cancelRequests.map((item) => ({
        label: item.status === 'PENDING' ? '취소 요청' : item.status === 'REJECTED' ? '요청 반려' : '취소',
        at: (item.decidedAt ?? item.requestedAt).toISOString(),
        who: item.decidedBy?.name || item.requestedBy.name,
        note: item.decisionNote || item.reason,
      })),
    ],
  };
}

async function mailTenant(tenantId: string, subject: string, text: string) {
  const admins = await prisma.user.findMany({
    where: { tenantId, role: 'ADMIN', isActive: true },
    select: { email: true },
    take: 5,
  });
  const to = admins.map((user) => user.email.trim()).filter(Boolean);
  if (to.length === 0) {
    console.info('[card-cancel] tenant mail skipped, no admin email', tenantId);
    return;
  }
  const html = text.replace(/[&<>]/g, (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));
  for (const address of to) {
    const sent = await sendPlatformMail({ to: address, subject, text, html: `<p>${html}</p>` });
    if (!sent.sent) console.info('[card-cancel] tenant mail not sent', sent.reason ?? '');
  }
}

export async function requestCardPaymentCancel(input: {
  tenantId: string;
  paymentId: string;
  userId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) return { error: '취소 사유를 적어 주세요.' as const, status: 400 as const };
  const row = await prisma.cardPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId },
    include: { tenant: { select: { name: true } } },
  });
  if (!row) return { error: '결제를 찾지 못했습니다.' as const, status: 404 as const };
  if (row.status !== 'APPROVED') return { error: '승인된 결제만 취소 요청할 수 있습니다.' as const, status: 400 as const };
  const sameDay = row.paidAt != null && kstYmd(row.paidAt) === kstYmd();
  if (row.method === 'CUSTOMER_LINK' && sameDay) {
    return { error: '오늘 승인된 링크 결제는 취소 요청 없이 바로 취소할 수 있습니다.' as const, status: 400 as const };
  }
  const pending = await prisma.cardPaymentCancelRequest.findFirst({
    where: { cardPaymentId: row.id, tenantId: row.tenantId, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) return { error: '이미 취소 요청이 올라가 있습니다.' as const, status: 409 as const };
  await prisma.cardPaymentCancelRequest.create({
    data: {
      tenantId: row.tenantId,
      cardPaymentId: row.id,
      requestedById: input.userId,
      reason: reason.slice(0, 500),
    },
  });
  await notifyPlatformOps({
    event: 'card_cancel_request',
    tenantId: row.tenantId,
    tenantLabel: row.tenant.name,
    title: '카드 취소 요청',
    body: `${row.tenant.name} · ${row.customerName} · ${row.amountWon.toLocaleString('ko-KR')}원 · ${reason.slice(0, 120)}`,
  });
  return { ok: true as const };
}

export async function cancelPlatformTenantPayment(input: {
  paymentId: string;
  platformUserId: string;
  reason: string;
  notifyTenant: boolean;
}) {
  const reason = input.reason.trim();
  if (!reason) return { error: '취소 사유를 적어 주세요.' as const, status: 400 as const };
  const row = await prisma.cardPayment.findFirst({ where: { id: input.paymentId } });
  if (!row) return { error: '결제를 찾지 못했습니다.' as const, status: 404 as const };
  const actor = await prisma.platformUser.findFirst({
    where: { id: input.platformUserId },
    select: { name: true },
  });
  const cancelled = await cancelCustomerLinkPayment({
    tenantId: row.tenantId,
    paymentId: row.id,
    actorName: actor?.name || '플랫폼',
  });
  if ('error' in cancelled) return cancelled;
  const closed = await prisma.cardPaymentCancelRequest.updateMany({
    where: { cardPaymentId: row.id, tenantId: row.tenantId, status: 'PENDING' },
    data: {
      status: 'DONE',
      decisionNote: reason.slice(0, 500),
      decidedByPlatformUserId: input.platformUserId,
      decidedAt: new Date(),
      notifyTenant: input.notifyTenant,
    },
  });
  if (closed.count === 0) {
    await prisma.cardPaymentCancelRequest.create({
      data: {
        tenantId: row.tenantId,
        cardPaymentId: row.id,
        requestedById: row.createdById,
        status: 'DONE',
        reason: reason.slice(0, 500),
        decisionNote: reason.slice(0, 500),
        decidedByPlatformUserId: input.platformUserId,
        notifyTenant: input.notifyTenant,
        decidedAt: new Date(),
      },
    });
  }
  if (input.notifyTenant) {
    await mailTenant(
      row.tenantId,
      '카드 결제가 취소되었습니다',
      `${row.customerName} ${row.amountWon.toLocaleString('ko-KR')}원 결제를 취소했습니다. 사유: ${reason}`,
    );
  }
  return { ok: true as const };
}

export async function rejectPlatformTenantCancel(input: {
  paymentId: string;
  platformUserId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) return { error: '반려 사유를 적어 주세요.' as const, status: 400 as const };
  const row = await prisma.cardPayment.findFirst({ where: { id: input.paymentId } });
  if (!row) return { error: '결제를 찾지 못했습니다.' as const, status: 404 as const };
  const updated = await prisma.cardPaymentCancelRequest.updateMany({
    where: { cardPaymentId: row.id, tenantId: row.tenantId, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      decisionNote: reason.slice(0, 500),
      decidedByPlatformUserId: input.platformUserId,
      decidedAt: new Date(),
    },
  });
  if (updated.count === 0) return { error: '대기 중인 취소 요청이 없습니다.' as const, status: 400 as const };
  await mailTenant(
    row.tenantId,
    '카드 취소 요청이 반려되었습니다',
    `${row.customerName} ${row.amountWon.toLocaleString('ko-KR')}원 취소 요청이 반려되었습니다. 사유: ${reason}`,
  );
  return { ok: true as const };
}

export async function markPlatformTenantCancelled(input: {
  paymentId: string;
  platformUserId: string;
  approvalNo: string;
}) {
  const row = await prisma.cardPayment.findFirst({ where: { id: input.paymentId } });
  if (!row) return { error: '결제를 찾지 못했습니다.' as const, status: 404 as const };
  if (row.status !== 'APPROVED') return { error: '승인 상태인 결제만 취소 완료로 표시할 수 있습니다.' as const, status: 400 as const };
  if (!row.approvalNo || input.approvalNo.trim() !== row.approvalNo) {
    return { error: '승인번호가 이 결제와 같지 않습니다.' as const, status: 400 as const };
  }
  await prisma.cardPayment.updateMany({
    where: { id: row.id, tenantId: row.tenantId, status: 'APPROVED' },
    data: { status: 'CANCELLED' },
  });
  await prisma.cardPaymentCancelRequest.updateMany({
    where: { cardPaymentId: row.id, tenantId: row.tenantId, status: 'PENDING' },
    data: { status: 'DONE', decidedByPlatformUserId: input.platformUserId, decidedAt: new Date() },
  });
  return { ok: true as const };
}

export async function revealTenantSellerCenter(paymentId: string) {
  const row = await prisma.cardPayment.findFirst({
    where: { id: paymentId },
    select: { tenantId: true },
  });
  if (!row) return { error: '결제를 찾지 못했습니다.' as const, status: 404 as const };
  const login = await readSellerCenterLogin(row.tenantId);
  if (!login.loginId || !login.password) {
    return { error: '이 업체 판매자센터 아이디가 없습니다.' as const, status: 400 as const };
  }
  return { ok: true as const, login };
}
