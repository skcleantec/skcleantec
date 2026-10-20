import type { CardPaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { syncKeyinCancelsFromPg } from './cardPaymentKeyinSync.service.js';
import { serializeCardPayment } from './cardPayment.serialize.js';

const OPEN_STATUSES: CardPaymentStatus[] = ['DRAFT', 'AWAITING_PG', 'LINK_SENT'];
const SETTLED_STATUSES: CardPaymentStatus[] = ['APPROVED', 'CANCELLED', 'FAILED'];

/** 같은 접수·방식·금액이 이미 결재완료·취소·실패로 이어졌으면, 앞에 남은 작성 대기는 목록에서 뺀다. */
export async function supersededOpenCardPaymentIds(tenantId?: string): Promise<string[]> {
  const opens = await prisma.cardPayment.findMany({
    where: { status: { in: OPEN_STATUSES }, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, inquiryId: true, method: true, amountWon: true, createdAt: true },
  });
  const inquiryIds = [...new Set(opens.map((row) => row.inquiryId).filter((id): id is string => Boolean(id)))];
  if (inquiryIds.length === 0) return [];
  const settled = await prisma.cardPayment.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      inquiryId: { in: inquiryIds },
      status: { in: SETTLED_STATUSES },
    },
    select: { inquiryId: true, method: true, amountWon: true, createdAt: true },
  });
  return opens
    .filter((open) =>
      settled.some(
        (row) =>
          row.inquiryId === open.inquiryId &&
          row.method === open.method &&
          row.amountWon === open.amountWon &&
          row.createdAt.getTime() >= open.createdAt.getTime(),
      ),
    )
    .map((row) => row.id);
}

export async function listCardPayments(input: {
  tenantId: string;
  createdById?: string;
  status?: CardPaymentStatus;
  pendingOnly?: boolean;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}) {
  await syncKeyinCancelsFromPg(input.tenantId);
  const hiddenIds = await supersededOpenCardPaymentIds(input.tenantId);
  const where: Prisma.CardPaymentWhereInput = { tenantId: input.tenantId };
  if (hiddenIds.length > 0) where.id = { notIn: hiddenIds };
  if (input.createdById) where.createdById = input.createdById;
  if (input.pendingOnly) where.status = { in: ['DRAFT', 'AWAITING_PG', 'LINK_SENT'] };
  else if (input.status) where.status = input.status;
  if (input.from || input.to) {
    where.createdAt = {};
    if (input.from) where.createdAt.gte = input.from;
    if (input.to) where.createdAt.lte = input.to;
  }

  const [items, total, approvedAgg] = await Promise.all([
    prisma.cardPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: input.limit,
      skip: input.offset,
      include: {
        createdBy: { select: { id: true, name: true } },
        inquiry: { select: { id: true, inquiryNumber: true, customerName: true, customerPhone: true } },
      },
    }),
    prisma.cardPayment.count({ where }),
    prisma.cardPayment.aggregate({
      where: { ...where, status: 'APPROVED' },
      _sum: {
        amountWon: true,
        tenantFeeWon: true,
        platformCostWon: true,
        platformSpreadWon: true,
        tenantNetWon: true,
      },
      _count: true,
    }),
  ]);

  return {
    total,
    items: items.map(serializeCardPayment),
    summary: {
      approvedCount: approvedAgg._count,
      amountWon: approvedAgg._sum.amountWon ?? 0,
      tenantFeeWon: approvedAgg._sum.tenantFeeWon ?? 0,
      platformCostWon: approvedAgg._sum.platformCostWon ?? 0,
      platformSpreadWon: approvedAgg._sum.platformSpreadWon ?? 0,
      tenantNetWon: approvedAgg._sum.tenantNetWon ?? 0,
    },
  };
}

export async function platformCardPaymentSummary() {
  const approved = await prisma.cardPayment.aggregate({
    where: { status: 'APPROVED' },
    _sum: {
      amountWon: true,
      tenantFeeWon: true,
      platformCostWon: true,
      platformSpreadWon: true,
    },
    _count: true,
  });
  return {
    approvedCount: approved._count,
    amountWon: approved._sum.amountWon ?? 0,
    tenantFeeWon: approved._sum.tenantFeeWon ?? 0,
    platformCostWon: approved._sum.platformCostWon ?? 0,
    platformSpreadWon: approved._sum.platformSpreadWon ?? 0,
  };
}
