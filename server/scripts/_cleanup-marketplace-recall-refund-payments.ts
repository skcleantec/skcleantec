/**
 * 정보공유 회수 버그로 생성된 잘못된 +금액 결재(「정보공유 회수 수수료 환불」) 삭제.
 * 사용: cd server && npx tsx scripts/_cleanup-marketplace-recall-refund-payments.ts [--apply]
 */
import { prisma } from '../src/lib/prisma.js';

const REFUND_MEMO = '정보공유 회수 수수료 환불';

async function main() {
  const apply = process.argv.includes('--apply');
  const rows = await prisma.tenantPartnerSettlementPayment.findMany({
    where: {
      memo: { contains: REFUND_MEMO },
      amount: { gt: 0 },
    },
    select: {
      id: true,
      tenantId: true,
      partnerTenantId: true,
      role: true,
      amount: true,
      paidAt: true,
      memo: true,
    },
    orderBy: { paidAt: 'desc' },
  });

  console.log(`잘못된 +금액 회수 환불 결재: ${rows.length}건`);
  for (const r of rows) {
    console.log(
      `  ${r.id} tenant=${r.tenantId} partner=${r.partnerTenantId} role=${r.role} amount=${r.amount} paidAt=${r.paidAt.toISOString()} memo=${r.memo}`,
    );
  }

  if (!apply) {
    console.log('\n삭제하려면: npx tsx scripts/_cleanup-marketplace-recall-refund-payments.ts --apply');
    return;
  }

  if (rows.length === 0) {
    console.log('삭제할 건 없음.');
    return;
  }

  const deleted = await prisma.tenantPartnerSettlementPayment.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });
  console.log(`\n삭제 완료: ${deleted.count}건`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
