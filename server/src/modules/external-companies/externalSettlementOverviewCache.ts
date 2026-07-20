import type { PrismaClient } from '@prisma/client';
import { sumExternalSettlementSignedFeeByCompany } from './externalSettlementOverview.service.js';

const TTL_MS = 5 * 60_000;

type CacheEntry = {
  at: number;
  fees: Map<string, number>;
};

const payableCache = new Map<string, CacheEntry>();

export function externalSettlementOverviewCacheKey(tenantId: string, operatingCompanyId: string): string {
  const day = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  return `${tenantId}:${operatingCompanyId}:${day}`;
}

export function invalidateExternalSettlementOverviewPayableCache(
  tenantId: string,
  operatingCompanyId?: string,
): void {
  if (operatingCompanyId) {
    payableCache.delete(externalSettlementOverviewCacheKey(tenantId, operatingCompanyId));
    return;
  }
  const prefix = `${tenantId}:`;
  for (const key of payableCache.keys()) {
    if (key.startsWith(prefix)) payableCache.delete(key);
  }
}

/** 누적 payable 집계 — 45초 TTL (목록 재진입·브랜드 전환 완화) */
export async function getExternalSettlementPayableFeesCached(
  prisma: PrismaClient,
  tenantId: string,
  operatingCompanyId: string,
): Promise<Map<string, number>> {
  const key = externalSettlementOverviewCacheKey(tenantId, operatingCompanyId);
  const hit = payableCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.fees;
  }
  const fees = await sumExternalSettlementSignedFeeByCompany(prisma, tenantId, operatingCompanyId);
  payableCache.set(key, { at: Date.now(), fees });
  return fees;
}
