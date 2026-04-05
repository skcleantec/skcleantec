/**
 * 랜덤 스케줄 시드로 넣은 접수 중 createdById 가 비어 있는 건에
 * 마케터(없으면 관리자)를 한 번에 채웁니다.
 *
 * 대상 memo: `[스케줄테스트 Mar-May` 또는 `[스케줄랜덤시드`
 *
 * 실행: cd server && npm run db:backfill-seed-inquiries-created-by
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const marketer = await prisma.user.findFirst({
    where: { role: 'MARKETER', isActive: true },
    orderBy: { email: 'asc' },
  });
  const createdById = marketer?.id ?? admin?.id;
  if (!createdById) {
    throw new Error('관리자 또는 마케터 계정이 없습니다.');
  }

  const result = await prisma.inquiry.updateMany({
    where: {
      createdById: null,
      OR: [{ memo: { contains: '[스케줄테스트 Mar-May' } }, { memo: { contains: '[스케줄랜덤시드' } }],
    },
    data: { createdById },
  });

  console.log(
    `backfill-seed-inquiries-created-by: ${result.count}건 갱신 (접수자: ${marketer ? marketer.email : 'admin'})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
