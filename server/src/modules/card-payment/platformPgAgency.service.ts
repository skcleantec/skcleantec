import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { decryptTenantSecret, encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import { maskSecretLast4, maskTid } from './cardPayment.mask.js';

export const PLATFORM_PG_AGENCY_ID = 'service-bridge';
export const PLATFORM_PG_AGENCY_NAME = '서비스브릿지 (대리점)';

type RailName = 'KEYIN' | 'LINK';

type AgencyRow = NonNullable<Awaited<ReturnType<typeof prisma.platformPgAgency.findUnique>>>;

function slot(row: AgencyRow | null, rail: RailName) {
  const mid = rail === 'KEYIN' ? row?.keyinMid : row?.linkMid;
  const oid = rail === 'KEYIN' ? row?.keyinOid : row?.linkOid;
  const tidMasked = rail === 'KEYIN' ? row?.keyinTidMasked : row?.linkTidMasked;
  const apiKeyLast4 = rail === 'KEYIN' ? row?.keyinApiKeyLast4 : row?.linkApiKeyLast4;
  const apiKeyEnc = rail === 'KEYIN' ? row?.keyinApiKeyEnc : row?.linkApiKeyEnc;
  if (!apiKeyEnc) return { connected: false as const };
  return {
    connected: true as const,
    isActive: true,
    mid: mid ?? null,
    oid: oid ?? null,
    tidMasked: tidMasked ?? null,
    apiKeyLast4: apiKeyLast4 ?? null,
  };
}

export async function getPlatformPgAgencyRow() {
  return prisma.platformPgAgency.findUnique({ where: { id: PLATFORM_PG_AGENCY_ID } });
}

export function platformAgencyListItem(row: AgencyRow | null) {
  return {
    tenantId: PLATFORM_PG_AGENCY_ID,
    tenantName: PLATFORM_PG_AGENCY_NAME,
    businessName: row?.businessName?.trim() || PLATFORM_PG_AGENCY_NAME,
    bizNumber: null,
    contactPhone: null,
    keyinMid: row?.keyinMid ?? null,
    linkMid: row?.linkMid ?? null,
    keyinKeyLast4: row?.keyinApiKeyLast4 ?? null,
    linkKeyLast4: row?.linkApiKeyLast4 ?? null,
    role: 'AGENCY' as const,
  };
}

export function platformAgencyDetail(row: AgencyRow | null) {
  return {
    tenantId: PLATFORM_PG_AGENCY_ID,
    tenantName: PLATFORM_PG_AGENCY_NAME,
    businessName: row?.businessName?.trim() || PLATFORM_PG_AGENCY_NAME,
    bizNumber: null,
    representativeName: null,
    addressLine: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    bankName: null,
    bankAccount: null,
    accountHolder: null,
    sellerLoginId: row?.sellerCenterLoginId?.trim() || '',
    sellerPasswordSet: Boolean(row?.sellerCenterPasswordEnc),
    role: 'AGENCY' as const,
    keyin: slot(row, 'KEYIN'),
    link: slot(row, 'LINK'),
  };
}

function assertRail(label: string, rail: { mid: string; oid: string; tid: string; apiKey: string }, expectKeyin: boolean) {
  const mid = rail.mid.trim();
  const oid = rail.oid.trim();
  const tid = rail.tid.trim();
  const apiKey = rail.apiKey.trim();
  if (mid && !/^[A-Za-z0-9]{4,32}$/.test(mid)) throw new Error(`${label} MID는 영문·숫자 4~32자리여야 합니다.`);
  if (oid && !/^[A-Za-z0-9]{4}$/.test(oid)) throw new Error(`${label} 주문번호 4자리를 확인해 주세요.`);
  if (!apiKey || /^\d{13,19}$/.test(apiKey.replace(/\s/g, ''))) throw new Error(`${label} API 키를 입력해 주세요. 카드번호는 받지 않습니다.`);
  if (expectKeyin && !apiKey.startsWith('ssp-')) throw new Error('수기 API 키는 ssp-로 시작해야 합니다.');
  if (!expectKeyin && apiKey.startsWith('ssp-')) throw new Error('인증 키는 결제창 mKey입니다. ssp- 키는 수기에 넣으세요.');
  if (expectKeyin && !tid) throw new Error('수기 TID를 입력해 주세요.');
  return { mid: mid || null, oid: oid || null, tid, apiKey };
}

/** 원성이 대리점 판매자센터·수기·인증을 고친다. 빈 키는 기존 값을 유지한다. */
export async function savePlatformAgencyFromPartner(input: {
  sellerLoginId?: string;
  sellerPassword?: string;
  rail?: RailName | '';
  mid?: string;
  oid?: string;
  tid?: string;
  apiKey?: string;
}) {
  const existing = await getPlatformPgAgencyRow();
  const data: Record<string, string | null> = {
    businessName: existing?.businessName?.trim() || PLATFORM_PG_AGENCY_NAME,
  };
  const sellerLoginId = input.sellerLoginId?.trim() ?? '';
  const sellerPassword = input.sellerPassword?.trim() ?? '';
  if (sellerLoginId) data.sellerCenterLoginId = sellerLoginId.slice(0, 64);
  if (sellerPassword) data.sellerCenterPasswordEnc = encryptTenantSecret(sellerPassword);
  const rail = input.rail === 'LINK' ? 'LINK' : input.rail === 'KEYIN' ? 'KEYIN' : '';
  if (rail) {
    const apiKey = input.apiKey?.trim() ?? '';
    const prefix = rail === 'KEYIN' ? 'keyin' : 'link';
    const storedKey = rail === 'KEYIN' ? existing?.keyinApiKeyEnc : existing?.linkApiKeyEnc;
    if (apiKey) {
      const checked = assertRail(rail === 'KEYIN' ? '수기' : '인증', {
        mid: input.mid ?? '',
        oid: input.oid ?? '',
        tid: input.tid ?? '',
        apiKey,
      }, rail === 'KEYIN');
      data[`${prefix}Mid`] = checked.mid;
      data[`${prefix}Oid`] = checked.oid;
      data[`${prefix}TidEnc`] = encryptTenantSecret(checked.tid || '-');
      data[`${prefix}ApiKeyEnc`] = encryptTenantSecret(checked.apiKey);
      data[`${prefix}TidMasked`] = checked.tid ? maskTid(checked.tid) : '';
      data[`${prefix}ApiKeyLast4`] = maskSecretLast4(checked.apiKey);
    } else if (storedKey) {
      const mid = input.mid?.trim() || (rail === 'KEYIN' ? existing?.keyinMid : existing?.linkMid) || null;
      const oid = input.oid?.trim() || (rail === 'KEYIN' ? existing?.keyinOid : existing?.linkOid) || null;
      if (mid && !/^[A-Za-z0-9]{4,32}$/.test(mid)) throw new Error('MID 형식을 확인해 주세요.');
      if (oid && !/^[A-Za-z0-9]{4}$/.test(oid)) throw new Error('OID는 영문·숫자 4자리여야 합니다.');
      data[`${prefix}Mid`] = mid;
      data[`${prefix}Oid`] = oid;
      const tid = input.tid?.trim() ?? '';
      if (tid) {
        data[`${prefix}TidEnc`] = encryptTenantSecret(tid);
        data[`${prefix}TidMasked`] = maskTid(tid);
      }
    } else if ((input.mid ?? '').trim() || (input.oid ?? '').trim() || (input.tid ?? '').trim()) {
      throw new Error('저장된 키가 없습니다. API 키를 입력해 주세요.');
    }
  }
  await prisma.platformPgAgency.upsert({
    where: { id: PLATFORM_PG_AGENCY_ID },
    create: { id: PLATFORM_PG_AGENCY_ID, businessName: PLATFORM_PG_AGENCY_NAME, ...data } as Prisma.PlatformPgAgencyCreateInput,
    update: data as Prisma.PlatformPgAgencyUpdateInput,
  });
}

export async function readPlatformAgencySecrets(rail: RailName) {
  const row = await getPlatformPgAgencyRow();
  const apiKeyEnc = rail === 'KEYIN' ? row?.keyinApiKeyEnc : row?.linkApiKeyEnc;
  const tidEnc = rail === 'KEYIN' ? row?.keyinTidEnc : row?.linkTidEnc;
  const apiKey = apiKeyEnc ? decryptTenantSecret(apiKeyEnc) ?? '' : '';
  const tidRaw = tidEnc ? decryptTenantSecret(tidEnc) ?? '' : '';
  const tid = tidRaw.trim() === '-' ? '' : tidRaw.trim();
  const sellerPassword = row?.sellerCenterPasswordEnc ? decryptTenantSecret(row.sellerCenterPasswordEnc) ?? '' : '';
  return { apiKey, tid, sellerPassword };
}

export function agencyMerchantFromRow(row: AgencyRow | null, rail: 'KEYIN' | 'APP_CARD') {
  if (!row) return null;
  const mid = (rail === 'KEYIN' ? row.keyinMid : row.linkMid)?.trim() ?? '';
  const oid = (rail === 'KEYIN' ? row.keyinOid : row.linkOid)?.trim() ?? '';
  const apiEnc = rail === 'KEYIN' ? row.keyinApiKeyEnc : row.linkApiKeyEnc;
  const tidEnc = rail === 'KEYIN' ? row.keyinTidEnc : row.linkTidEnc;
  if (!mid || !oid || !apiEnc || !tidEnc) return null;
  const apiKey = decryptTenantSecret(apiEnc)?.trim() ?? '';
  const tidRaw = decryptTenantSecret(tidEnc)?.trim() ?? '';
  const tid = tidRaw === '-' ? '' : tidRaw;
  if (!apiKey || !tid || !/^[A-Za-z0-9]{4}$/.test(oid)) return null;
  return { channel: rail, mid, tid, apiKey, oid };
}
