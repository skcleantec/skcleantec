import type { TenantPgRail } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret, encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import { maskSecretLast4, maskTid } from './cardPayment.mask.js';
import { serializeCredentialPublic } from './cardPayment.serialize.js';
import type { WspayCredential } from './wspayAdapter.js';

export type PgCredentialRail = 'KEYIN' | 'LINK';

export async function getCredentialBundle(tenantId: string) {
  const rows = await prisma.tenantPgCredential.findMany({ where: { tenantId } });
  const keyin = rows.find((row) => row.rail === 'KEYIN') ?? null;
  const link = rows.find((row) => row.rail === 'LINK') ?? null;
  return {
    keyin: serializeCredentialPublic(keyin),
    link: serializeCredentialPublic(link),
  };
}

/** 레이아웃 게이트용. 수기·링크 중 하나라도 연결되면 true. */
export async function getCredentialPublic(tenantId: string) {
  const bundle = await getCredentialBundle(tenantId);
  const connected = bundle.keyin.connected || bundle.link.connected;
  return { connected };
}

export async function getDecryptedCredential(
  tenantId: string,
  rail: PgCredentialRail,
): Promise<WspayCredential | null> {
  const row = await prisma.tenantPgCredential.findFirst({
    where: { tenantId, rail: rail as TenantPgRail, isActive: true },
  });
  if (!row) return null;
  const apiKey = decryptTenantSecret(row.apiKeyEnc);
  const tid = decryptTenantSecret(row.tidEnc) ?? '';
  const tidPlain = tid.trim() === '-' ? '' : tid.trim();
  if (!apiKey) return null;
  if (rail === 'KEYIN' && !tidPlain) return null;
  return { apiKey, tid: tidPlain, mid: row.mid, oid: row.oid };
}

export async function saveCredentialFromPlatform(input: {
  tenantId: string;
  rail: PgCredentialRail;
  apiKey: string;
  tid?: string | null;
  mid?: string | null;
  oid?: string | null;
  webhookSecret?: string | null;
}) {
  const rail = input.rail === 'LINK' ? 'LINK' : 'KEYIN';
  const apiKey = input.apiKey.trim();
  const tid = (input.tid ?? '').trim();
  const mid = input.mid?.trim() || null;
  const oid = input.oid?.trim() || null;
  if (!apiKey) {
    throw new Error('API 키가 필요합니다.');
  }
  if (rail === 'KEYIN' && !tid) {
    throw new Error('수기 키는 TID가 필요합니다.');
  }
  if (rail === 'KEYIN' && !apiKey.startsWith('ssp-')) {
    throw new Error('수기 키는 ssp- 로 시작하는 API 키입니다.');
  }
  if (rail === 'LINK' && apiKey.startsWith('ssp-')) {
    throw new Error('링크 키에는 수기용 ssp- 키를 넣지 않습니다.');
  }
  if (mid && !/^[A-Za-z0-9]{4,32}$/.test(mid)) {
    throw new Error('MID 형식을 확인해 주세요.');
  }
  if (oid && !/^[A-Za-z0-9]{4}$/.test(oid)) {
    throw new Error('OID는 영문·숫자 4자리여야 합니다.');
  }
  const now = new Date();
  const row = await prisma.tenantPgCredential.upsert({
    where: { tenantId_rail: { tenantId: input.tenantId, rail } },
    create: {
      tenantId: input.tenantId,
      rail,
      apiKeyEnc: encryptTenantSecret(apiKey),
      tidEnc: encryptTenantSecret(tid || '-'),
      webhookSecretEnc: input.webhookSecret?.trim()
        ? encryptTenantSecret(input.webhookSecret.trim())
        : null,
      apiKeyLast4: maskSecretLast4(apiKey),
      tidMasked: tid ? maskTid(tid) : '',
      mid,
      oid,
      isActive: true,
      connectedAt: now,
    },
    update: {
      apiKeyEnc: encryptTenantSecret(apiKey),
      tidEnc: encryptTenantSecret(tid || '-'),
      webhookSecretEnc: input.webhookSecret?.trim()
        ? encryptTenantSecret(input.webhookSecret.trim())
        : null,
      apiKeyLast4: maskSecretLast4(apiKey),
      tidMasked: tid ? maskTid(tid) : '',
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

/** 키가 비어 있으면 기존 암호를 유지하고 MID·OID·TID만 고친다. */
export async function updateCredentialFromPartner(input: {
  tenantId: string;
  rail: PgCredentialRail;
  apiKey?: string | null;
  tid?: string | null;
  mid?: string | null;
  oid?: string | null;
}) {
  const apiKey = input.apiKey?.trim() ?? '';
  if (apiKey) {
    return saveCredentialFromPlatform({
      tenantId: input.tenantId,
      rail: input.rail,
      apiKey,
      tid: input.tid,
      mid: input.mid,
      oid: input.oid,
    });
  }
  const rail = input.rail === 'LINK' ? 'LINK' : 'KEYIN';
  const existing = await prisma.tenantPgCredential.findFirst({
    where: { tenantId: input.tenantId, rail },
  });
  if (!existing) throw new Error('저장된 키가 없습니다. API 키를 입력해 주세요.');
  const mid = input.mid?.trim() || existing.mid;
  const oid = input.oid?.trim() || existing.oid;
  const tid = input.tid?.trim() ?? '';
  if (mid && !/^[A-Za-z0-9]{4,32}$/.test(mid)) throw new Error('MID 형식을 확인해 주세요.');
  if (oid && !/^[A-Za-z0-9]{4}$/.test(oid)) throw new Error('OID는 영문·숫자 4자리여야 합니다.');
  if (rail === 'KEYIN' && tid === '' && !existing.tidEnc) throw new Error('수기 키는 TID가 필요합니다.');
  const now = new Date();
  await prisma.tenantPgCredential.updateMany({
    where: { id: existing.id, tenantId: input.tenantId, rail },
    data: {
      mid,
      oid,
      ...(tid ? { tidEnc: encryptTenantSecret(tid), tidMasked: maskTid(tid) } : {}),
      isActive: true,
      connectedAt: now,
    },
  });
  const row = await prisma.tenantPgCredential.findFirst({
    where: { id: existing.id, tenantId: input.tenantId, rail },
  });
  if (!row) throw new Error('가맹 정보를 저장하지 못했습니다.');
  await prisma.tenantPgOnboarding.updateMany({
    where: { tenantId: input.tenantId },
    data: { status: 'APPROVED', decidedAt: now },
  });
  return serializeCredentialPublic(row);
}

/** 원성이 비밀번호를 확인한 뒤에만 호출한다. 로그에 남기지 않는다. */
export async function readCredentialSecrets(tenantId: string, rail: PgCredentialRail) {
  const row = await prisma.tenantPgCredential.findFirst({
    where: { tenantId, rail },
    select: { apiKeyEnc: true, tidEnc: true },
  });
  if (!row) return { apiKey: '', tid: '' };
  const apiKey = decryptTenantSecret(row.apiKeyEnc) ?? '';
  const tidRaw = decryptTenantSecret(row.tidEnc) ?? '';
  return { apiKey, tid: tidRaw.trim() === '-' ? '' : tidRaw.trim() };
}
