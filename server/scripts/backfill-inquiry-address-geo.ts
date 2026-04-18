/**
 * 접수별 주소 지오코딩 캐시(address_geo_*)를 채운다. 기존 데이터 일괄 갱신용.
 *
 * 로컬:
 *   cd server && npx tsx scripts/backfill-inquiry-address-geo.ts
 *   npx tsx scripts/backfill-inquiry-address-geo.ts --limit=50
 *
 * 카카오 REST 키가 있으면 빠르고, 없으면 Nominatim(건당 지연)으로 매우 느릴 수 있다.
 */
import { prisma } from '../src/lib/prisma.js';
import { syncInquiryAddressGeo } from '../src/modules/inquiries/inquiryAddressGeoSync.js';

function parseLimit(argv: string[]): number | undefined {
  const raw = argv.find((a) => a.startsWith('--limit='));
  if (!raw) return undefined;
  const n = parseInt(raw.slice('--limit='.length), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const limit = parseLimit(process.argv.slice(2));
  const rows = await prisma.inquiry.findMany({
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    ...(limit != null ? { take: limit } : {}),
  });
  const total = rows.length;
  console.log(`[backfill-inquiry-address-geo] ${total}건 처리 시작`);
  let done = 0;
  for (const r of rows) {
    await syncInquiryAddressGeo(prisma, r.id, { force: true });
    done++;
    if (done % 25 === 0 || done === total) {
      console.log(`  ${done}/${total}`);
    }
  }
  console.log('[backfill-inquiry-address-geo] 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
