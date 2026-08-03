import type { TenantStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  monthlyCoinAllowance,
  normalizePlanId,
  planHasUnlimitedCoins,
} from '../tenants/tenantFeatureCatalog.js';
import { isSignupCoinGraceActive } from '../tenants/tenantSignupGrace.js';
import { kstPeriodYmFromDate } from '../tenants/tenantCoin.service.js';

export type PlatformCoinUsageRow = {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: TenantStatus;
  unlimited: boolean;
  graceActive: boolean;
  allowance: number | null;
  spent: number;
  remaining: number | null;
  pctUsed: number | null;
};

export type PlatformCoinUsageKpi = {
  tenantCount: number;
  totalSpent: number;
  unlimitedTenantCount: number;
  limitedTenantCount: number;
  nearLimitCount: number;
  zeroSpentCount: number;
};

export type PlatformCoinUsageListResult = {
  periodYm: string;
  items: PlatformCoinUsageRow[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  kpi: PlatformCoinUsageKpi;
};

function parsePeriodYm(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return kstPeriodYmFromDate();
}

export function parsePlatformCoinUsageListQuery(query: Record<string, unknown>): {
  periodYm: string;
  q: string;
  plan: string;
  status: string;
  sort: 'spent_desc' | 'spent_asc' | 'name';
  page: number;
  pageSize: number;
} {
  const periodYm = parsePeriodYm(query.periodYm);
  const q = String(query.q ?? '').trim().slice(0, 80);
  const plan = String(query.plan ?? '').trim();
  const status = String(query.status ?? '').trim();
  const sortRaw = String(query.sort ?? 'spent_desc');
  const sort =
    sortRaw === 'spent_asc' || sortRaw === 'name' ? sortRaw : ('spent_desc' as const);
  const pageSizeRaw = Number(query.pageSize ?? query.limit ?? 30);
  const pageSize = [30, 50, 80, 100].includes(pageSizeRaw) ? pageSizeRaw : 30;
  const pageRaw = Number(query.page ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  return { periodYm, q, plan, status, sort, page, pageSize };
}

export async function listPlatformCoinUsage(
  query: Record<string, unknown>,
): Promise<PlatformCoinUsageListResult> {
  const { periodYm, q, plan, status, sort, page, pageSize } = parsePlatformCoinUsageListQuery(query);

  const [tenants, spentGroups] = await Promise.all([
    prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        plan: true,
        status: true,
        config: true,
        trialEndsAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.tenantCoinLedgerEntry.groupBy({
      by: ['tenantId'],
      where: { periodYm },
      _sum: { amount: true },
    }),
  ]);

  const spentByTenant = new Map<string, number>();
  for (const g of spentGroups) {
    spentByTenant.set(g.tenantId, g._sum.amount ?? 0);
  }

  let rows: PlatformCoinUsageRow[] = tenants.map((t) => {
    const planId = normalizePlanId(t.plan);
    const graceActive = isSignupCoinGraceActive(t);
    const unlimited = planHasUnlimitedCoins(planId) || graceActive;
    const allowance = monthlyCoinAllowance(planId);
    const spent = spentByTenant.get(t.id) ?? 0;
    const remaining = unlimited || allowance == null ? null : Math.max(0, allowance - spent);
    const pctUsed =
      unlimited || allowance == null || allowance <= 0
        ? null
        : Math.min(999, Math.round((spent / allowance) * 100));
    return {
      tenantId: t.id,
      slug: t.slug,
      name: t.name,
      plan: planId,
      status: t.status,
      unlimited,
      graceActive,
      allowance,
      spent,
      remaining,
      pctUsed,
    };
  });

  if (q) {
    const qq = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(qq) ||
        r.slug.toLowerCase().includes(qq),
    );
  }
  if (plan) {
    rows = rows.filter((r) => r.plan === plan);
  }
  if (status) {
    rows = rows.filter((r) => r.status === status);
  }

  const kpi: PlatformCoinUsageKpi = {
    tenantCount: rows.length,
    totalSpent: rows.reduce((s, r) => s + r.spent, 0),
    unlimitedTenantCount: rows.filter((r) => r.unlimited).length,
    limitedTenantCount: rows.filter((r) => !r.unlimited).length,
    nearLimitCount: rows.filter(
      (r) => !r.unlimited && r.pctUsed != null && r.pctUsed >= 80,
    ).length,
    zeroSpentCount: rows.filter((r) => r.spent === 0).length,
  };

  if (sort === 'spent_asc') {
    rows.sort((a, b) => a.spent - b.spent || a.name.localeCompare(b.name, 'ko'));
  } else if (sort === 'name') {
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  } else {
    rows.sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name, 'ko'));
  }

  const total = rows.length;
  const offset = (page - 1) * pageSize;
  const items = rows.slice(offset, offset + pageSize);

  return {
    periodYm,
    items,
    total,
    limit: pageSize,
    offset,
    page,
    kpi,
  };
}
