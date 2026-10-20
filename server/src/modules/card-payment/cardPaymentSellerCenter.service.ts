import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret, encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';

export const SELLER_CENTER_URL = 'https://wspay.net';
export const SELLER_CENTER_LOGIN_URL = 'https://wspay.net/login_check.php';

export async function saveSellerCenterLogin(tenantId: string, loginId: string, password: string) {
  const id = loginId.trim();
  const pw = password.trim();
  if (!id || !pw) {
    throw new Error('판매자센터 아이디와 비밀번호를 모두 입력해 주세요.');
  }
  if (id.length > 64) throw new Error('판매자센터 아이디가 너무 깁니다.');
  await prisma.tenantPgOnboarding.upsert({
    where: { tenantId },
    create: {
      tenantId,
      sellerCenterLoginId: id,
      sellerCenterPasswordEnc: encryptTenantSecret(pw),
    },
    update: {
      sellerCenterLoginId: id,
      sellerCenterPasswordEnc: encryptTenantSecret(pw),
    },
  });
}

/** 비밀번호는 그대로 두고 아이디만 고친다. */
export async function saveSellerCenterLoginId(tenantId: string, loginId: string) {
  const id = loginId.trim().slice(0, 64);
  if (!id) return;
  await prisma.tenantPgOnboarding.updateMany({
    where: { tenantId },
    data: { sellerCenterLoginId: id },
  });
}

/** 관리자 화면·취소 로그인 전용. 비밀번호 원문을 돌려준다. */
export async function readSellerCenterLogin(tenantId: string) {
  const row = await prisma.tenantPgOnboarding.findFirst({
    where: { tenantId },
    select: { sellerCenterLoginId: true, sellerCenterPasswordEnc: true, businessName: true },
  });
  const password = row?.sellerCenterPasswordEnc ? decryptTenantSecret(row.sellerCenterPasswordEnc) : null;
  return {
    portalUrl: SELLER_CENTER_URL,
    loginUrl: SELLER_CENTER_LOGIN_URL,
    businessName: row?.businessName?.trim() || '',
    loginId: row?.sellerCenterLoginId?.trim() || '',
    password: password ?? '',
  };
}
