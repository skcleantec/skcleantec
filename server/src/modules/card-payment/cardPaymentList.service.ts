import type { CardPaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { serializeCardPayment } from './cardPayment.serialize.js';

export async function listCardPayments(input: {
  tenantId: string;
  createdById?: string;
  status?: CardPaymentStatus;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}) {
  const where: Prisma.CardPaymentWhereInput = { tenantId: input.tenantId };
  if (input.createdById) where.createdById = input.createdById;
  if (input.status) where.status = input.status;
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
        inquiry: { select: { id: true, inquiryNumber: true, customerName: true } },
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
