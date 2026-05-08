/**
 * 사원증 프리미엄 인증 뱃지 PNG를 Cloudinary에 한 번 업로드합니다.
 * 사용: cd server && node scripts/upload-staff-premium-cert-badge.mjs
 * (server/.env 에 CLOUDINARY_URL 또는 분리 변수 필요)
 */
import { readFileSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

function configureCloudinary() {
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url?.startsWith('cloudinary://')) {
    const without = url.replace(/^cloudinary:\/\//, '');
    const at = without.lastIndexOf('@');
    if (at <= 0) return false;
    const cloudName = without.slice(at + 1);
    const keySecret = without.slice(0, at);
    const colon = keySecret.indexOf(':');
    if (colon <= 0) return false;
    const apiKey = keySecret.slice(0, colon);
    const apiSecret = keySecret.slice(colon + 1);
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    return true;
  }
  const cn = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const ak = process.env.CLOUDINARY_API_KEY?.trim();
  const as = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cn && ak && as) {
    cloudinary.config({ cloud_name: cn, api_key: ak, api_secret: as, secure: true });
    return true;
  }
  return false;
}

const repoRoot = resolve(__dirname, '../..');
const defaultPng = join(repoRoot, 'client/public/images/staff-premium-certified-badge.png');

async function main() {
  if (!configureCloudinary()) {
    console.error('CLOUDINARY_URL 또는 CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET 이 없습니다.');
    process.exit(1);
  }
  const pngPath = process.argv[2] || defaultPng;
  const buf = readFileSync(pngPath);
  const b64 = `data:image/png;base64,${buf.toString('base64')}`;

  const result = await cloudinary.uploader.upload(b64, {
    folder: 'skcleanteck/static',
    public_id: 'staff-premium-certified-badge',
    overwrite: true,
    resource_type: 'image',
    unique_filename: false,
  });

  if (!result?.secure_url) {
    console.error('업로드 실패', result);
    process.exit(1);
  }
  console.log('secure_url:', result.secure_url);
  console.log('public_id:', result.public_id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
