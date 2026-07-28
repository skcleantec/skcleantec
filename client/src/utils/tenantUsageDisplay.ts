import type { TenantSubscriptionDto } from '../api/tenantSubscription';
import { usagePercent } from '@shared/tenantSubscriptionUsage';

export const TENANT_SUBSCRIPTION_ADMIN_PATH = '/admin/team-leaders/company-profile/subscription';

export type TenantUsageRow = TenantSubscriptionDto['usage'][number];

export function pickTenantUsage(
  usage: TenantUsageRow[] | undefined,
  id: TenantUsageRow['id'],
  fallback: TenantUsageRow,
): TenantUsageRow {
  return usage?.find((u) => u.id === id) ?? fallback;
}

/** 0~100 게이지·바 채움 비율. unlimited(null limit) → null */
export function gaugeFillPercent(used: number, limit: number | null): number | null {
  if (limit == null) return null;
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / limit) * 1000) / 10);
}

/** 반원 게이지 바늘·눈금 각도 (SVG rotate, 12시 기준). 0%=9시, 100%=3시 */
export function gaugeNeedleRotateDeg(fillPercent: number): number {
  const pct = Math.max(0, Math.min(100, fillPercent));
  return -90 + pct * 1.8;
}

export function formatUsageRatio(used: number, limit: number | null, unit: string): string {
  if (limit == null) return `${used.toLocaleString()}${unit} (무제한)`;
  return `${used.toLocaleString()} / ${limit.toLocaleString()}${unit}`;
}

export function usageWarnLevel(
  used: number,
  limit: number | null,
): 'ok' | 'warn' | 'over' | 'unlimited' {
  if (limit == null) return 'unlimited';
  if (used > limit) return 'over';
  const pct = usagePercent(used, limit);
  if (pct != null && pct >= 85) return 'warn';
  return 'ok';
}

export function resolveCoinUsage(data: TenantSubscriptionDto): {
  used: number;
  limit: number | null;
  unlimited: boolean;
  remaining: number | null;
  unit: string;
  label: string;
} {
  const coins = data.coins;
  const row = pickTenantUsage(data.usage, 'monthlyCoins', {
    id: 'monthlyCoins',
    label: '이용 코인',
    used: 0,
    limit: null,
    unit: '코인',
  });

  if (coins?.unlimited) {
    return {
      used: coins.spent,
      limit: null,
      unlimited: true,
      remaining: null,
      unit: '코인',
      label: row.label,
    };
  }

  const allowance = coins?.allowance ?? row.limit;
  const spent = coins?.spent ?? row.used;
  const remaining =
    coins?.remaining ?? (allowance != null ? Math.max(0, allowance - spent) : null);

  return {
    used: spent,
    limit: allowance,
    unlimited: false,
    remaining,
    unit: '코인',
    label: row.label,
  };
}

export function buildDashboardUsageSummary(data: TenantSubscriptionDto): string {
  const coin = resolveCoinUsage(data);
  const team = pickTenantUsage(data.usage, 'teamLeaders', {
    id: 'teamLeaders',
    label: '팀장',
    used: 0,
    limit: null,
    unit: '명',
  });
  const brands = pickTenantUsage(data.usage, 'operatingBrands', {
    id: 'operatingBrands',
    label: '브랜드',
    used: 0,
    limit: null,
    unit: '개',
  });

  const coinPart = coin.unlimited
    ? '코인 무제한'
    : coin.limit != null
      ? `코인 ${coin.used.toLocaleString()}/${coin.limit.toLocaleString()}`
      : `코인 ${coin.used.toLocaleString()}`;

  const teamPart =
    team.limit != null
      ? `팀장 ${team.used.toLocaleString()}/${team.limit.toLocaleString()}명`
      : `팀장 ${team.used.toLocaleString()}명`;

  const brandPart =
    brands.limit != null
      ? `브랜드 ${brands.used.toLocaleString()}/${brands.limit.toLocaleString()}개`
      : `브랜드 ${brands.used.toLocaleString()}개`;

  return `${coinPart} · ${teamPart} · ${brandPart}`;
}
