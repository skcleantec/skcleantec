import type { TenantShareAsSourceRow } from '../../lib/externalSettlementAttribution.js';

function shareStatusPriority(syncStatus: string): number {
  if (syncStatus === 'ACTIVE') return 3;
  if (syncStatus === 'PAUSED') return 2;
  return 1;
}

/** 정산·표시용 — ACTIVE share 우선, 없으면 최 recent REVOKED 등 */
export function pickPrimaryShareAsSource(
  shares: ReadonlyArray<{ syncStatus: string }> | null | undefined,
): TenantShareAsSourceRow {
  if (!shares?.length) return null;
  const sorted = [...shares].sort(
    (a, b) => shareStatusPriority(b.syncStatus) - shareStatusPriority(a.syncStatus),
  );
  return (sorted[0] as TenantShareAsSourceRow) ?? null;
}

/** Prisma where — ACTIVE source share 없음 (REVOKED 이력은 허용) */
export const noActiveSourceShareWhere = {
  tenantSharesAsSource: { none: { syncStatus: 'ACTIVE' as const } },
} as const;
