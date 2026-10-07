import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret, encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import { maskSecretLast4, maskTid } from './cardPayment.mask.js';
import { serializeCredentialPublic } from './cardPayment.serialize.js';
import type { WspayCredential } from './wspayAdapter.js';

export async function getCredentialPublic(tenantId: string) {
  const row = await prisma.tenantPgCredential.findFirst({ where: { tenantId } });
  return serializeCredentialPublic(row);
}

export async function getDecryptedCredential(tenantId: string): Promise<WspayCredential | null> {
  const row = await prisma.tenantPgCredential.findFirst({
    where: { tenantId, isActive: true },
  });
  if (!row) return null;
  const apiKey = decryptTenantSecret(row.apiKeyEnc);
  const tid = decryptTenantSecret(row.tidEnc);
  if (!apiKey || !tid) return null;
  return { apiKey, tid, mid: row.mid, oid: row.oid };
}

export async function saveCredentialFromPlatform(input: {
  tenantId: string;
  apiKey: string;
  tid: string;
  mid?: string | null;
  oid?: string | null;
  webhookSecret?: string | null;
}) {
  const apiKey = input.apiKey.trim();
  const tid = input.tid.trim();
  const mid = input.mid?.trim() || null;
  const oid = input.oid?.trim() || null;
  if (!apiKey || !tid) {
    throw new Error('API 키와 TID가 필요합니다.');
  }
  if (mid && !/^[A-Za-z0-9]{4,32}$/.test(mid)) {
    throw new Error('MID 형식을 확인해 주세요.');
  }
  if (oid && !/^[A-Za-z0-9]{4}$/.test(oid)) {
    throw new Error('OID는 영문·숫자 4자리여야 합니다.');
  }
  const now = new Date();
  const row = await prisma.tenantPgCredential.upsert({
    where: { tenantId: input.tenantId },
    create: {
      tenantId: input.tenantId,
      apiKeyEnc: encryptTenantSecret(apiKey),
      tidEnc: encryptTenantSecret(tid),
      webhookSecretEnc: input.webhookSecret?.trim()
        ? encryptTenantSecret(input.webhookSecret.trim())
        : null,
      apiKeyLast4: maskSecretLast4(apiKey),
      tidMasked: maskTid(tid),
      mid,
      oid,
      isActive: true,
      connectedAt: now,
    },
    update: {
      apiKeyEnc: encryptTenantSecret(apiKey),
      tidEnc: encryptTenantSecret(tid),
      webhookSecretEnc: input.webhookSecret?.trim()
        ? encryptTenantSecret(input.webhookSecret.trim())
        : null,
      apiKeyLast4: maskSecretLast4(apiKey),
      tidMasked: maskTid(tid),
      mid,
      oid,
      isActive: true,
      connectedAt: now,
    },
  });
  await prisma.tenantPgOnboarding.updateMany({
    where: { tenantId: input.tenantId },
    data: { status: 'APPROVED', decidedAt: now },
  });
  return serializeCredentialPublic(row);
}
