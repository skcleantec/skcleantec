import { agencyMerchantFromRow, getPlatformPgAgencyRow } from './platformPgAgency.service.js';
import { probeWspayListAuth } from './wspayAdapter.js';
import { buildWspayOrderId, normalizeWspayOid } from './wspayOrderId.js';

export type ServiceBridgeChannel = 'KEYIN' | 'APP_CARD';

export type ServiceBridgeMerchant = {
  channel: ServiceBridgeChannel;
  mid: string;
  tid: string;
  apiKey: string;
  oid: string;
};

function readMerchant(channel: ServiceBridgeChannel, prefix: string): ServiceBridgeMerchant | null {
  const mid = process.env[`${prefix}_MID`]?.trim() ?? '';
  const tid = process.env[`${prefix}_TID`]?.trim() ?? '';
  const apiKey = process.env[`${prefix}_API_KEY`]?.trim() ?? '';
  const oid = normalizeWspayOid(process.env[`${prefix}_OID`] ?? '');
  if (!mid || !tid || !apiKey || !oid) return null;
  if (!/^[A-Za-z0-9]{4,32}$/.test(mid)) return null;
  return { channel, mid, tid, apiKey, oid };
}

/** 서비스브릿지 이용료 가맹. 원성이 저장한 대리점 코드를 먼저 쓰고, 없으면 서버 설정을 씁니다. */
export async function loadServiceBridgeMerchants() {
  const row = await getPlatformPgAgencyRow();
  return {
    keyin: agencyMerchantFromRow(row, 'KEYIN') ?? readMerchant('KEYIN', 'WSPAY_SB_KEYIN'),
    appCard: agencyMerchantFromRow(row, 'APP_CARD') ?? readMerchant('APP_CARD', 'WSPAY_SB_APP'),
  };
}

function maskTail(value: string): string {
  if (value.length <= 4) return value;
  return `${'•'.repeat(Math.min(6, value.length - 4))}${value.slice(-4)}`;
}

export async function serviceBridgePublicStatus() {
  const merchants = await loadServiceBridgeMerchants();
  const view = (row: ServiceBridgeMerchant | null) =>
    row
      ? {
          configured: true as const,
          mid: row.mid,
          tidMasked: maskTail(row.tid),
          oid: row.oid,
          apiKeyLast4: row.apiKey.slice(-4),
        }
      : { configured: false as const };
  return {
    purpose: 'USAGE_FEE' as const,
    keyin: view(merchants.keyin),
    appCard: view(merchants.appCard),
  };
}

export async function buildServiceBridgeOrderId(channel: ServiceBridgeChannel, uniquePart: string) {
  const merchants = await loadServiceBridgeMerchants();
  const row = channel === 'KEYIN' ? merchants.keyin : merchants.appCard;
  if (!row) return null;
  return buildWspayOrderId(row.oid, uniquePart);
}

/** 카드 승인 없이, 이용료용 키가 조회 API 인증을 통과하는지만 봅니다. */
export async function probeServiceBridgeAuth() {
  const merchants = await loadServiceBridgeMerchants();
  const keyin = merchants.keyin
    ? { configured: true as const, ...(await probeWspayListAuth(merchants.keyin)) }
    : { configured: false as const };
  return {
    keyin,
    appCard: merchants.appCard
      ? { configured: true as const, listApi: false as const }
      : { configured: false as const },
  };
}
