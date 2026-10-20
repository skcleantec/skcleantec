import type { CardPaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { syncKeyinCancelsFromPg } from './cardPaymentKeyinSync.service.js';
import { serializeCardPayment } from './cardPayment.serialize.js';

/** 같은 접수는 가장 최근 한 줄만 남긴다. 그 줄의 상태가 현재 상태다. */
export async function olderSameInquiryCardPaymentIds(where: Prisma.CardPaymentWhereInput): Promise<string[]> {
  const rows = await prisma.cardPayment.findMany({
    where: { ...where, inquiryId: { not: null } },
    select: { id: true, inquiryId: true },
    orderBy: { createdAt: 'desc' },
  });
  const seen = new Set<string>();
  const hide: string[] = [];
  for (const row of rows) {
    if (!row.inquiryId) continue;
    if (seen.has(row.inquiryId)) hide.push(row.id);
    else seen.add(row.inquiryId);
  }
  return hide;
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
  const scope: Prisma.CardPaymentWhereInput = { tenantId: input.tenantId };
  if (input.createdById) scope.createdById = input.createdById;
  if (input.pendingOnly) scope.status = { in: ['DRAFT', 'AWAITING_PG', 'LINK_SENT'] };
  else if (input.status) scope.status = input.status;
  if (input.from || input.to) {
    scope.createdAt = {};
    if (input.from) scope.createdAt.gte = input.from;
    if (input.to) scope.createdAt.lte = input.to;
  }
  const hiddenIds = await olderSameInquiryCardPaymentIds(scope);
  const where: Prisma.CardPaymentWhereInput = { ...scope };
  if (hiddenIds.length > 0) where.id = { notIn: hiddenIds };

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
      where: { ...scope, status: 'APPROVED' },
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
