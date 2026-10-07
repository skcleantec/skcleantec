import { prisma } from '../../lib/prisma.js';

export async function listPartnerRefunds() {
  const [cards, fees] = await Promise.all([
    prisma.cardPayment.findMany({
      where: { status: 'CANCELLED' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        amountWon: true,
        customerName: true,
        inquiryNumber: true,
        approvalNo: true,
        pgOrderId: true,
        cardLast4: true,
        payRail: true,
        pgClerkNo: true,
        updatedAt: true,
        paidAt: true,
        tenant: { select: { name: true } },
      },
    }),
    prisma.usageFeeCardPayment.findMany({
      where: { status: 'CANCELLED' },
      orderBy: { paidAt: 'desc' },
      take: 100,
      select: {
        id: true,
        amountKrw: true,
        goodsName: true,
        buyerName: true,
        approvalNo: true,
        pgOrderId: true,
        cardLast4: true,
        payMethod: true,
        memo: true,
        paidAt: true,
        tenant: { select: { name: true } },
      },
    }),
  ]);

  const items = [
    ...cards.map((row) => ({
      id: `card:${row.id}`,
      kind: '청소 결제',
      tenantName: row.tenant.name,
      title: row.customerName,
      detail: row.inquiryNumber,
      amountKrw: row.amountWon,
      approvalNo: row.approvalNo,
      pgOrderId: row.pgOrderId,
      cardLast4: row.cardLast4,
      method: row.payRail === 'PAY_WINDOW' ? '결제창' : '수기',
      clerkNo: row.pgClerkNo,
      at: (row.updatedAt ?? row.paidAt)?.toISOString() ?? null,
      memo: null as string | null,
    })),
    ...fees.map((row) => ({
      id: `fee:${row.id}`,
      kind: '이용료',
      tenantName: row.tenant?.name ?? '플랫폼',
      title: row.goodsName,
      detail: row.buyerName,
      amountKrw: row.amountKrw,
      approvalNo: row.approvalNo,
      pgOrderId: row.pgOrderId,
      cardLast4: row.cardLast4,
      method: row.payMethod === 'PAY_WINDOW' ? '결제창' : '수기',
      clerkNo: null as number | null,
      at: row.paidAt.toISOString(),
      memo: row.memo,
    })),
  ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  return { items };
}
