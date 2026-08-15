import type { TenantStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  monthlyCoinAllowance,
  normalizePlanId,
  planHasUnlimitedCoins,
} from '../tenants/tenantFeatureCatalog.js';
import { isSignupCoinGraceActive } from '../tenants/tenantSignupGrace.js';
import { kstPeriodYmFromDate } from '../tenants/tenantCoin.service.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';

export type PlatformAiUsageUserBreakdown = {
  userId: string | null;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  count: number;
};

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
  aiUsageCount: number;
  aiUsers: PlatformAiUsageUserBreakdown[];
  telecrmAiUsageCount: number;
  telecrmAiUsers: PlatformAiUsageUserBreakdown[];
};

export type PlatformCoinUsageKpi = {
  totalAllTenants: number;
  activeCount: number;
  trialCount: number;
  suspendedCount: number;
  tenantCount: number;
  totalSpent: number;
  unlimitedTenantCount: number;
  limitedTenantCount: number;
  nearLimitCount: number;
  zeroSpentCount: number;
  totalAiUsageCount: number;
  totalTelecrmAiUsageCount: number;
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

const USER_ROLE_LABEL: Record<string, string> = {
  ADMIN: '관리자',
  MARKETER: '마케터',
  TEAM_LEADER: '팀장',
  OFFICE_STAFF: '사무직',
  EXTERNAL_PARTNER: '타업체',
};

function roleLabel(role: string): string {
  return USER_ROLE_LABEL[role] ?? role;
}

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
  focus: '' | 'near_limit' | 'zero' | 'unlimited' | 'limited' | 'ai';
  sort: 'spent_desc' | 'spent_asc' | 'name' | 'ai_desc' | 'ai_asc';
  page: number;
  pageSize: number;
} {
  const periodYm = parsePeriodYm(query.periodYm);
  const q = String(query.q ?? '').trim().slice(0, 80);
  const plan = String(query.plan ?? '').trim();
  const status = String(query.status ?? '').trim();
  const focusRaw = String(query.focus ?? '').trim();
  const focus =
    focusRaw === 'near_limit' ||
    focusRaw === 'zero' ||
    focusRaw === 'unlimited' ||
    focusRaw === 'limited' ||
    focusRaw === 'ai'
      ? focusRaw
      : ('' as const);
  const sortRaw = String(query.sort ?? 'spent_desc');
  const sort =
    sortRaw === 'spent_asc' ||
    sortRaw === 'name' ||
    sortRaw === 'ai_desc' ||
    sortRaw === 'ai_asc'
      ? sortRaw
      : ('spent_desc' as const);
  const pageSizeRaw = Number(query.pageSize ?? query.limit ?? 30);
  const pageSize = [30, 50, 80, 100].includes(pageSizeRaw) ? pageSizeRaw : 30;
  const pageRaw = Number(query.page ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  return { periodYm, q, plan, status, focus, sort, page, pageSize };
}

function applyCoinUsageFocusFilter(
  rows: PlatformCoinUsageRow[],
  focus: '' | 'near_limit' | 'zero' | 'unlimited' | 'limited' | 'ai',
): PlatformCoinUsageRow[] {
  switch (focus) {
    case 'near_limit':
      return rows.filter((r) => !r.unlimited && r.pctUsed != null && r.pctUsed >= 80);
    case 'zero':
      return rows.filter((r) => r.spent === 0);
    case 'unlimited':
      return rows.filter((r) => r.unlimited);
    case 'limited':
      return rows.filter((r) => !r.unlimited);
    case 'ai':
      return rows.filter((r) => r.aiUsageCount > 0 || r.telecrmAiUsageCount > 0);
    default:
      return rows;
  }
}

export async function listPlatformCoinUsage(
  query: Record<string, unknown>,
): Promise<PlatformCoinUsageListResult> {
  const { periodYm, q, plan, status, focus, sort, page, pageSize } = parsePlatformCoinUsageListQuery(query);

  const monthRange = kstMonthRangeYm(periodYm);

  const [tenants, spentGroups, aiUsageGroups, aiUserGroups, telecrmAiUsageGroups, telecrmAiUserGroups] =
    await Promise.all([
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
    prisma.quickPasteLearningLog.groupBy({
      by: ['tenantId'],
      where: {
        aiApplied: true,
        ...(monthRange ? { createdAt: monthRange } : {}),
      },
      _count: { aiApplied: true },
    }),
    prisma.quickPasteLearningLog.groupBy({
      by: ['tenantId', 'userId'],
      where: {
        aiApplied: true,
        ...(monthRange ? { createdAt: monthRange } : {}),
      },
      _count: { aiApplied: true },
    }),
    prisma.telecrmAiUsageLog.groupBy({
      by: ['tenantId'],
      where: monthRange ? { createdAt: monthRange } : {},
      _count: { id: true },
    }),
    prisma.telecrmAiUsageLog.groupBy({
      by: ['tenantId', 'userId'],
      where: monthRange ? { createdAt: monthRange } : {},
      _count: { id: true },
    }),
  ]);

  const spentByTenant = new Map<string, number>();
  for (const g of spentGroups) {
    spentByTenant.set(g.tenantId, g._sum.amount ?? 0);
  }

  const aiUsageByTenant = new Map<string, number>();
  for (const g of aiUsageGroups) {
    aiUsageByTenant.set(g.tenantId, g._count.aiApplied ?? 0);
  }

  const telecrmAiUsageByTenant = new Map<string, number>();
  for (const g of telecrmAiUsageGroups) {
    telecrmAiUsageByTenant.set(g.tenantId, g._count.id ?? 0);
  }

  const aiUserIds = [
    ...new Set([
      ...aiUserGroups.map((g) => g.userId).filter((id): id is string => typeof id === 'string' && id.length > 0),
      ...telecrmAiUserGroups
        .map((g) => g.userId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ]),
  ];
  const aiUsersById = new Map<
    string,
    { id: string; name: string; email: string; role: string }
  >();
  if (aiUserIds.length > 0) {
    const userRows = await prisma.user.findMany({
      where: { id: { in: aiUserIds } },
      select: { id: true, name: true, email: true, role: true },
    });
    for (const u of userRows) {
      aiUsersById.set(u.id, u);
    }
  }

  const aiUsersByTenant = new Map<string, PlatformAiUsageUserBreakdown[]>();
  for (const g of aiUserGroups) {
    const count = g._count.aiApplied ?? 0;
    if (count <= 0) continue;
    const list = aiUsersByTenant.get(g.tenantId) ?? [];
    if (g.userId) {
      const u = aiUsersById.get(g.userId);
      list.push({
        userId: g.userId,
        name: u?.name ?? '(삭제된 사용자)',
        email: u?.email ?? '—',
        role: u?.role ?? '—',
        roleLabel: u ? roleLabel(u.role) : '—',
        count,
      });
    } else {
      list.push({
        userId: null,
        name: '사용자 미기록',
        email: '—',
        role: '—',
        roleLabel: '—',
        count,
      });
    }
    aiUsersByTenant.set(g.tenantId, list);
  }
  for (const [tenantId, list] of aiUsersByTenant) {
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
    aiUsersByTenant.set(tenantId, list);
  }

  const telecrmAiUsersByTenant = new Map<string, PlatformAiUsageUserBreakdown[]>();
  for (const g of telecrmAiUserGroups) {
    const count = g._count.id ?? 0;
    if (count <= 0) continue;
    const list = telecrmAiUsersByTenant.get(g.tenantId) ?? [];
    if (g.userId) {
      const u = aiUsersById.get(g.userId);
      list.push({
        userId: g.userId,
        name: u?.name ?? '(삭제된 사용자)',
        email: u?.email ?? '—',
        role: u?.role ?? '—',
        roleLabel: u ? roleLabel(u.role) : '—',
        count,
      });
    } else {
      list.push({
        userId: null,
        name: '사용자 미기록',
        email: '—',
        role: '—',
        roleLabel: '—',
        count,
      });
    }
    telecrmAiUsersByTenant.set(g.tenantId, list);
  }
  for (const [tenantId, list] of telecrmAiUsersByTenant) {
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
    telecrmAiUsersByTenant.set(tenantId, list);
  }

  let rows: PlatformCoinUsageRow[] = tenants.map((t) => {
    const planId = normalizePlanId(t.plan);
    const graceActive = isSignupCoinGraceActive(t);
    const unlimited = planHasUnlimitedCoins(planId) || graceActive;
    const allowance = monthlyCoinAllowance(planId);
    const spent = spentByTenant.get(t.id) ?? 0;
    const aiUsageCount = aiUsageByTenant.get(t.id) ?? 0;
    const telecrmAiUsageCount = telecrmAiUsageByTenant.get(t.id) ?? 0;
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
      aiUsageCount,
      aiUsers: aiUsersByTenant.get(t.id) ?? [],
      telecrmAiUsageCount,
      telecrmAiUsers: telecrmAiUsersByTenant.get(t.id) ?? [],
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
    totalAllTenants: tenants.length,
    activeCount: tenants.filter((t) => t.status === 'ACTIVE').length,
    trialCount: tenants.filter((t) => t.status === 'TRIAL').length,
    suspendedCount: tenants.filter((t) => t.status === 'SUSPENDED').length,
    tenantCount: rows.length,
    totalSpent: rows.reduce((s, r) => s + r.spent, 0),
    unlimitedTenantCount: rows.filter((r) => r.unlimited).length,
    limitedTenantCount: rows.filter((r) => !r.unlimited).length,
    nearLimitCount: rows.filter(
      (r) => !r.unlimited && r.pctUsed != null && r.pctUsed >= 80,
    ).length,
    zeroSpentCount: rows.filter((r) => r.spent === 0).length,
    totalAiUsageCount: rows.reduce((s, r) => s + r.aiUsageCount, 0),
    totalTelecrmAiUsageCount: rows.reduce((s, r) => s + r.telecrmAiUsageCount, 0),
  };

  rows = applyCoinUsageFocusFilter(rows, focus);

  if (sort === 'spent_asc') {
    rows.sort((a, b) => a.spent - b.spent || a.name.localeCompare(b.name, 'ko'));
  } else if (sort === 'name') {
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  } else if (sort === 'ai_asc') {
    rows.sort(
      (a, b) =>
        a.aiUsageCount + a.telecrmAiUsageCount - (b.aiUsageCount + b.telecrmAiUsageCount) ||
        a.name.localeCompare(b.name, 'ko'),
    );
  } else if (sort === 'ai_desc') {
    rows.sort(
      (a, b) =>
        b.aiUsageCount + b.telecrmAiUsageCount - (a.aiUsageCount + a.telecrmAiUsageCount) ||
        a.name.localeCompare(b.name, 'ko'),
    );
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
