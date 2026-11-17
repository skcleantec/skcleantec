/**
 * 조회만 한다. 행을 고치거나 지우지 않는다.
 *
 * 부재(ABSENT)·보류(ON_HOLD) 중 고객명이 그 행의 주소와 같은 건을 출력한다.
 * 운영 DB에서 실행·수정하지 말 것. 사람이 결과를 보고 따로 고친다.
 *
 *   cd server
 *   npx tsx scripts/find-soomgo-region-as-name.ts
 */
import { prisma } from '../src/lib/prisma.js';

function compact(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const rows = await prisma.orderFollowup.findMany({
    where: { status: { in: ['ABSENT', 'ON_HOLD'] } },
    select: {
      id: true,
      tenantId: true,
      operatingCompanyId: true,
      status: true,
      customerName: true,
      nickname: true,
      address: true,
      customerPhone: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const hits = rows.filter((row) => {
    const name = compact(row.customerName);
    const nick = compact(row.nickname);
    const place = compact(row.address);
    if (!place) return false;
    return name === place || (nick.length > 0 && nick === place);
  });

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        matched: hits.length,
        note: '조회만. 수정하지 않음.',
        items: hits.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          operatingCompanyId: row.operatingCompanyId,
          status: row.status,
          customerName: row.customerName,
          nickname: row.nickname,
          address: row.address,
          customerPhone: row.customerPhone,
          createdAt: row.createdAt.toISOString(),
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
