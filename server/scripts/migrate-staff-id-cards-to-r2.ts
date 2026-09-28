/**
 * 사원증(팀장·마케터·현장 팀원) Cloudinary URL → R2 복사 후 DB 주소 교체.
 * Cloudinary 공개 주소가 401이면 서명 URL로 재시도한다.
 *
 *   npx tsx scripts/migrate-staff-id-cards-to-r2.ts --dry
 *   npx tsx scripts/migrate-staff-id-cards-to-r2.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { copyCloudinaryImageToR2 } from '../src/lib/copyCloudinaryImageToR2.js';
import { isR2Configured } from '../src/lib/r2.js';

const dry = process.argv.includes('--dry') || process.argv.includes('--dry-run');

function isCloudinaryUrl(raw: string | null | undefined): raw is string {
  return typeof raw === 'string' && raw.includes('res.cloudinary.com');
}

type Stats = { scanned: number; moved: number; failed: number };

const stats: Stats = { scanned: 0, moved: 0, failed: 0 };

if (!isR2Configured() && !dry) {
  console.error('R2_NOT_CONFIGURED');
  process.exit(1);
}

const users = await prisma.user.findMany({
  where: { staffIdCardUrl: { contains: 'cloudinary' } },
  select: { id: true, tenantId: true, staffIdCardUrl: true, staffIdCardPublicId: true },
});

for (const row of users) {
  if (!isCloudinaryUrl(row.staffIdCardUrl)) continue;
  stats.scanned += 1;
  if (dry) {
    stats.moved += 1;
    continue;
  }
  const copied = await copyCloudinaryImageToR2({
    url: row.staffIdCardUrl,
    publicId: row.staffIdCardPublicId,
    folder: `cbiseo/staff-id-cards/users/${row.id}`,
  });
  if (!copied) {
    stats.failed += 1;
    continue;
  }
  await prisma.user.updateMany({
    where: { id: row.id, tenantId: row.tenantId },
    data: { staffIdCardUrl: copied.secureUrl, staffIdCardPublicId: copied.publicId },
  });
  stats.moved += 1;
}

const members = await prisma.teamMember.findMany({
  where: { staffIdCardUrl: { contains: 'cloudinary' } },
  select: { id: true, tenantId: true, staffIdCardUrl: true, staffIdCardPublicId: true },
});

for (const row of members) {
  if (!isCloudinaryUrl(row.staffIdCardUrl)) continue;
  stats.scanned += 1;
  if (dry) {
    stats.moved += 1;
    continue;
  }
  const copied = await copyCloudinaryImageToR2({
    url: row.staffIdCardUrl,
    publicId: row.staffIdCardPublicId,
    folder: `cbiseo/staff-id-cards/team-members/${row.id}`,
  });
  if (!copied) {
    stats.failed += 1;
    continue;
  }
  await prisma.teamMember.updateMany({
    where: { id: row.id, tenantId: row.tenantId },
    data: { staffIdCardUrl: copied.secureUrl, staffIdCardPublicId: copied.publicId },
  });
  stats.moved += 1;
}

console.log(JSON.stringify({ dry, users: users.length, members: members.length, ...stats }, null, 2));
await prisma.$disconnect();
