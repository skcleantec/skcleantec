/**
 * 기존 C/S 제출 사진을 로컬/Railway 볼륨(/uploads/cs)에서 Cloudinary로 이전하고
 * CsReport.imageUrls 의 주소를 Cloudinary secure_url 로 교체한다.
 *
 * - 실행 환경: 사진 파일이 실제로 있는 곳(= Railway 볼륨이 마운트된 컨테이너)에서
 *   DATABASE_URL 과 CLOUDINARY_URL(또는 분리 변수)이 모두 설정된 채로 실행한다.
 *   예) Railway 앱 서비스의 일회성 명령:  npm --prefix server run db:migrate-cs-images
 * - idempotent: 이미 Cloudinary(외부) 주소로 바뀐 항목은 건너뛴다. 여러 번 실행해도 안전.
 * - 유지보수 스크립트라 전 테넌트의 자기 행만 in-place 로 주소를 갱신한다(타 테넌트 데이터 이동 없음).
 *
 * 옵션:  --dry-run  (실제 업로드/DB 수정 없이 대상만 출력)
 */
import path from 'path';
import fs from 'fs';
import { prisma } from '../src/lib/prisma.js';
import { isCloudinaryConfigured } from '../src/lib/cloudinary.js';
import { uploadCsImageBuffer } from '../src/modules/cs/csImageUpload.js';

const dryRun = process.argv.includes('--dry-run');
const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads');
const csDir = path.join(uploadDir, 'cs');

/** `.../uploads/cs/<filename>` 에서 파일명만 추출. Cloudinary 등 외부 URL이면 null */
function extractCsFilename(url: string): string | null {
  const marker = '/uploads/cs/';
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  const rest = url.slice(idx + marker.length);
  const name = rest.split('?')[0];
  return name || null;
}

async function main(): Promise<void> {
  if (!isCloudinaryConfigured()) {
    console.error('CLOUDINARY 가 설정되지 않았습니다. CLOUDINARY_URL(또는 분리 변수)을 설정한 환경에서 실행하세요.');
    process.exit(1);
  }

  const rows = await prisma.csReport.findMany({
    select: { id: true, imageUrls: true },
    orderBy: { createdAt: 'asc' },
  });

  let scanned = 0;
  let uploaded = 0;
  let changedRows = 0;
  let missing = 0;

  for (const row of rows) {
    const urls = Array.isArray(row.imageUrls) ? (row.imageUrls as unknown[]) : [];
    if (urls.length === 0) continue;

    let changed = false;
    const next: string[] = [];

    for (const raw of urls) {
      const url = typeof raw === 'string' ? raw : '';
      if (!url) {
        next.push(String(raw));
        continue;
      }
      const filename = extractCsFilename(url);
      if (!filename) {
        next.push(url); // 이미 Cloudinary 등 외부 URL
        continue;
      }
      scanned++;
      const filePath = path.join(csDir, filename);
      if (!fs.existsSync(filePath)) {
        missing++;
        console.warn(`[missing] report=${row.id} file=${filename} (원본 파일 없음 → 주소 유지)`);
        next.push(url);
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] report=${row.id} → upload ${filename}`);
        next.push(url);
        continue;
      }
      const buffer = fs.readFileSync(filePath);
      const { secureUrl } = await uploadCsImageBuffer(buffer);
      next.push(secureUrl);
      uploaded++;
      changed = true;
    }

    if (changed && !dryRun) {
      await prisma.csReport.update({ where: { id: row.id }, data: { imageUrls: next } });
      changedRows++;
    }
  }

  console.log(
    `완료: 로컬URL 대상 ${scanned}건, 업로드 ${uploaded}건, 수정 행 ${changedRows}건, 원본없음 ${missing}건${dryRun ? ' (dry-run)' : ''}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
