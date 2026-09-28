/** 사원증 Cloudinary 잔여 건 — 상태 코드만. URL·이름은 출력하지 않음. */
import { prisma } from '../src/lib/prisma.js';
import { cloudinary, isCloudinaryAccountConfigured } from '../src/lib/cloudinary.js';
import { publicIdFromCloudinaryUrl } from '../src/lib/copyCloudinaryImageToR2.js';

const users = await prisma.user.findMany({
  where: { staffIdCardUrl: { contains: 'cloudinary' } },
  select: { staffIdCardUrl: true, staffIdCardPublicId: true },
});

const fetchStatus: Record<string, number> = {};
const apiStatus: Record<string, number> = {};
let withPid = 0;

for (const row of users) {
  const url = row.staffIdCardUrl?.trim() ?? '';
  if (!url) continue;
  try {
    const res = await fetch(url, { redirect: 'follow', method: 'GET' });
    const key = String(res.status);
    fetchStatus[key] = (fetchStatus[key] ?? 0) + 1;
  } catch {
    fetchStatus.network = (fetchStatus.network ?? 0) + 1;
  }
  const pid = row.staffIdCardPublicId?.trim() || publicIdFromCloudinaryUrl(url);
  if (pid) withPid += 1;
  if (pid && isCloudinaryAccountConfigured()) {
    try {
      await cloudinary.api.resource(pid, { resource_type: 'image' });
      apiStatus.ok = (apiStatus.ok ?? 0) + 1;
    } catch (e) {
      const err = e as { error?: { http_code?: number }; http_code?: number };
      const code = String(err.error?.http_code ?? err.http_code ?? 'err');
      apiStatus[code] = (apiStatus[code] ?? 0) + 1;
    }
  }
}

console.log(JSON.stringify({ remainingUsers: users.length, withPid, fetchStatus, apiStatus }, null, 2));
await prisma.$disconnect();
