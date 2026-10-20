/**
 * 서비스브릿지 대리점 판매자센터를 저장한다.
 * 비밀번호·API 키는 환경변수로만 받고, 출력하지 않는다.
 * 이미 서버에 있는 이용료 코드(WSPAY_SB_*)가 있으면 같이 암호화해 둔다.
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const PREFIX = 'v1:';

function encrypt(plain) {
  const raw = (process.env.TENANT_SECRET_KEY ?? '').trim() || (process.env.JWT_SECRET ?? '').trim();
  if (!raw) throw new Error('JWT_SECRET is required');
  const key = crypto.createHash('sha256').update(raw, 'utf8').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${enc.toString('base64url')}`;
}

function maskLast4(value) {
  const text = value.trim();
  if (text.length <= 4) return '****';
  return `****${text.slice(-4)}`;
}

function maskTid(value) {
  const text = value.trim();
  if (text.length <= 4) return '****';
  if (text.length <= 8) return `${text.slice(0, 2)}****`;
  return `${text.slice(0, 3)}****${text.slice(-2)}`;
}

function envMerchant(prefix) {
  const mid = process.env[`${prefix}_MID`]?.trim() ?? '';
  const tid = process.env[`${prefix}_TID`]?.trim() ?? '';
  const apiKey = process.env[`${prefix}_API_KEY`]?.trim() ?? '';
  const oid = process.env[`${prefix}_OID`]?.trim() ?? '';
  if (!mid || !tid || !apiKey || !/^[A-Za-z0-9]{4}$/.test(oid)) return null;
  return { mid, tid, apiKey, oid };
}

function railData(name, merchant) {
  if (!merchant) return {};
  return {
    [`${name}Mid`]: merchant.mid,
    [`${name}Oid`]: merchant.oid,
    [`${name}TidEnc`]: encrypt(merchant.tid),
    [`${name}ApiKeyEnc`]: encrypt(merchant.apiKey),
    [`${name}TidMasked`]: maskTid(merchant.tid),
    [`${name}ApiKeyLast4`]: maskLast4(merchant.apiKey),
  };
}

const loginId = (process.env.AGENCY_LOGIN_ID ?? '').trim();
const password = (process.env.AGENCY_PASSWORD ?? '').trim();
if (!loginId || !password) {
  console.error('AGENCY_LOGIN_ID and AGENCY_PASSWORD are required');
  process.exit(1);
}

const prisma = new PrismaClient();
const data = {
  businessName: '서비스브릿지 (대리점)',
  sellerCenterLoginId: loginId.slice(0, 64),
  sellerCenterPasswordEnc: encrypt(password),
  ...railData('keyin', envMerchant('WSPAY_SB_KEYIN')),
  ...railData('link', envMerchant('WSPAY_SB_APP')),
};

await prisma.platformPgAgency.upsert({
  where: { id: 'service-bridge' },
  create: { id: 'service-bridge', ...data },
  update: data,
});

console.log(JSON.stringify({
  businessName: data.businessName,
  loginId,
  keyin: Boolean(process.env.WSPAY_SB_KEYIN_MID),
  appCard: Boolean(process.env.WSPAY_SB_APP_MID),
}));
await prisma.$disconnect();
