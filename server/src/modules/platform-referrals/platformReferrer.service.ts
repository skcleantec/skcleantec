import type {
  PlatformReferrerCommissionStatus,
  PlatformReferrerStatus,
  PlatformReferrerType,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  PLATFORM_REFERRER_DEFAULT_COMMISSION_RATE_BPS,
  formatReferrerCommissionRateBps,
} from './platformReferral.constants.js';
import { assertValidReferrerCode, normalizeReferrerCode } from './platformReferralCode.helpers.js';

export class PlatformReferrerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformReferrerError';
  }
}

function parseCommissionRateBps(raw: unknown): number {
  if (raw == null || raw === '') return PLATFORM_REFERRER_DEFAULT_COMMISSION_RATE_BPS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10_000) {
    throw new PlatformReferrerError('수수료율은 0~100% 사이여야 합니다.');
  }
  return Math.round(n);
}

function parseEligiblePlanIds(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) throw new PlatformReferrerError('적용 플랜 형식이 올바르지 않습니다.');
  const ids = raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  return ids.length ? ids : null;
}

function mapReferrerRow(row: {
  id: string;
  type: PlatformReferrerType;
  code: string;
  displayName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  partnerTenantId: string | null;
  commissionRateBps: number;
  eligiblePlanIds: unknown;
  status: PlatformReferrerStatus;
  memo: string | null;
  createdAt: Date;
  updatedAt: Date;
  partnerTenant?: { id: string; slug: string; name: string } | null;
}) {
  return {
    id: row.id,
    type: row.type,
    code: row.code,
    displayName: row.displayName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    partnerTenantId: row.partnerTenantId,
    partnerTenant: row.partnerTenant
      ? { id: row.partnerTenant.id, slug: row.partnerTenant.slug, name: row.partnerTenant.name }
      : null,
    commissionRateBps: row.commissionRateBps,
    commissionRateLabel: formatReferrerCommissionRateBps(row.commissionRateBps),
    eligiblePlanIds: parseEligiblePlanIds(row.eligiblePlanIds),
    status: row.status,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPlatformReferrers(params?: { status?: PlatformReferrerStatus; q?: string }) {
  const where: Prisma.PlatformReferrerWhereInput = {};
  if (params?.status) where.status = params.status;
  const q = params?.q?.trim();
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { displayName: { contains: q, mode: 'insensitive' } },
      { contactEmail: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.platformReferrer.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      partnerTenant: { select: { id: true, slug: true, name: true } },
      _count: { select: { attributions: true } },
    },
  });

  const ids = rows.map((r) => r.id);
  const commissionSums =
    ids.length === 0
      ? []
      : await prisma.platformReferrerCommissionAccrual.groupBy({
          by: ['referrerId', 'status'],
          where: { referrerId: { in: ids } },
          _sum: { commissionAmount: true },
        });
  const sumMap = new Map<string, { pending: number; paid: number }>();
  for (const g of commissionSums) {
    const prev = sumMap.get(g.referrerId) ?? { pending: 0, paid: 0 };
    const amount = g._sum.commissionAmount ?? 0;
    if (g.status === 'PAID') prev.paid += amount;
    else if (g.status === 'PENDING' || g.status === 'APPROVED') prev.pending += amount;
    sumMap.set(g.referrerId, prev);
  }

  const paidTenantGroups =
    ids.length === 0
      ? []
      : await prisma.platformReferrerCommissionAccrual.groupBy({
          by: ['referrerId', 'tenantId'],
          where: { referrerId: { in: ids } },
        });
  const paidTenantCountMap = new Map<string, number>();
  for (const row of paidTenantGroups) {
    paidTenantCountMap.set(row.referrerId, (paidTenantCountMap.get(row.referrerId) ?? 0) + 1);
  }

  return {
    items: rows.map((row) => ({
      ...mapReferrerRow(row),
      signupCount: row._count.attributions,
      paidTenantCount: paidTenantCountMap.get(row.id) ?? 0,
      pendingCommissionKrw: sumMap.get(row.id)?.pending ?? 0,
      paidCommissionKrw: sumMap.get(row.id)?.paid ?? 0,
    })),
  };
}

export async function getPlatformReferrerDetail(id: string) {
  const row = await prisma.platformReferrer.findUnique({
    where: { id },
    include: { partnerTenant: { select: { id: true, slug: true, name: true } } },
  });
  if (!row) throw new PlatformReferrerError('추천인을 찾을 수 없습니다.');

  const [signupCount, commissionAgg, paidTenantGroups] = await Promise.all([
    prisma.tenantReferralAttribution.count({ where: { referrerId: id } }),
    prisma.platformReferrerCommissionAccrual.groupBy({
      by: ['status'],
      where: { referrerId: id },
      _sum: { commissionAmount: true },
    }),
    prisma.platformReferrerCommissionAccrual.groupBy({
      by: ['tenantId'],
      where: { referrerId: id },
    }),
  ]);

  let pendingCommissionKrw = 0;
  let paidCommissionKrw = 0;
  for (const g of commissionAgg) {
    const amount = g._sum.commissionAmount ?? 0;
    if (g.status === 'PAID') paidCommissionKrw += amount;
    else if (g.status === 'PENDING' || g.status === 'APPROVED') pendingCommissionKrw += amount;
  }

  return {
    ...mapReferrerRow(row),
    signupCount,
    paidTenantCount: paidTenantGroups.length,
    pendingCommissionKrw,
    paidCommissionKrw,
    signupLink: `https://www.cbiseo.com/signup?ref=${encodeURIComponent(row.code)}`,
  };
}

export async function createPlatformReferrer(input: {
  type: PlatformReferrerType;
  code: string;
  displayName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  partnerTenantId?: string | null;
  commissionRateBps?: number;
  eligiblePlanIds?: string[] | null;
  memo?: string | null;
}) {
  const code = normalizeReferrerCode(input.code);
  assertValidReferrerCode(code);
  const displayName = input.displayName.trim();
  if (!displayName) throw new PlatformReferrerError('이름을 입력해 주세요.');
  if (input.type === 'PARTNER' && !input.partnerTenantId?.trim()) {
    throw new PlatformReferrerError('파트너 유형은 연결 업체를 선택해 주세요.');
  }

  const taken = await prisma.platformReferrer.findUnique({ where: { code }, select: { id: true } });
  if (taken) throw new PlatformReferrerError('이미 사용 중인 추천인 코드입니다.');

  if (input.partnerTenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.partnerTenantId },
      select: { id: true },
    });
    if (!tenant) throw new PlatformReferrerError('연결 업체를 찾을 수 없습니다.');
  }

  const row = await prisma.platformReferrer.create({
    data: {
      type: input.type,
      code,
      displayName,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      partnerTenantId: input.partnerTenantId?.trim() || null,
      commissionRateBps: parseCommissionRateBps(input.commissionRateBps),
      eligiblePlanIds: parseEligiblePlanIds(input.eligiblePlanIds) ?? undefined,
      memo: input.memo?.trim() || null,
    },
    include: { partnerTenant: { select: { id: true, slug: true, name: true } } },
  });

  return mapReferrerRow(row);
}

export async function updatePlatformReferrer(
  id: string,
  input: {
    displayName?: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    partnerTenantId?: string | null;
    commissionRateBps?: number;
    eligiblePlanIds?: string[] | null;
    status?: PlatformReferrerStatus;
    memo?: string | null;
  },
) {
  const existing = await prisma.platformReferrer.findUnique({ where: { id }, select: { id: true, type: true } });
  if (!existing) throw new PlatformReferrerError('추천인을 찾을 수 없습니다.');

  const data: Prisma.PlatformReferrerUpdateInput = {};
  if (input.displayName != null) {
    const displayName = input.displayName.trim();
    if (!displayName) throw new PlatformReferrerError('이름을 입력해 주세요.');
    data.displayName = displayName;
  }
  if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail?.trim() || null;
  if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone?.trim() || null;
  if (input.commissionRateBps != null) data.commissionRateBps = parseCommissionRateBps(input.commissionRateBps);
  if (input.eligiblePlanIds !== undefined) {
    data.eligiblePlanIds = parseEligiblePlanIds(input.eligiblePlanIds) ?? Prisma.JsonNull;
  }
  if (input.status != null) data.status = input.status;
  if (input.memo !== undefined) data.memo = input.memo?.trim() || null;
  if (input.partnerTenantId !== undefined) {
    if (existing.type === 'PARTNER' && !input.partnerTenantId?.trim()) {
      throw new PlatformReferrerError('파트너 유형은 연결 업체가 필요합니다.');
    }
    if (input.partnerTenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: input.partnerTenantId },
        select: { id: true },
      });
      if (!tenant) throw new PlatformReferrerError('연결 업체를 찾을 수 없습니다.');
      data.partnerTenant = { connect: { id: input.partnerTenantId } };
    } else {
      data.partnerTenant = { disconnect: true };
    }
  }

  const row = await prisma.platformReferrer.update({
    where: { id },
    data,
    include: { partnerTenant: { select: { id: true, slug: true, name: true } } },
  });
  return mapReferrerRow(row);
}

export async function listReferrerSignups(referrerId: string, limit = 50, offset = 0) {
  const [items, total] = await Promise.all([
    prisma.tenantReferralAttribution.findMany({
      where: { referrerId },
      orderBy: { attributedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        tenant: { select: { id: true, slug: true, name: true, plan: true, status: true, createdAt: true } },
      },
    }),
    prisma.tenantReferralAttribution.count({ where: { referrerId } }),
  ]);

  const tenantIds = items.map((i) => i.tenantId);
  const paidCounts =
    tenantIds.length === 0
      ? []
      : await prisma.platformReferrerCommissionAccrual.groupBy({
          by: ['tenantId'],
          where: { referrerId, tenantId: { in: tenantIds }, status: { not: 'REVERSED' } },
          _count: { id: true },
          _sum: { commissionAmount: true },
        });
  const paidMap = new Map(
    paidCounts.map((g) => [g.tenantId, { count: g._count.id, sum: g._sum.commissionAmount ?? 0 }]),
  );

  return {
    total,
    items: items.map((row) => ({
      id: row.id,
      signupMethod: row.signupMethod,
      refCodeUsed: row.refCodeUsed,
      attributedAt: row.attributedAt.toISOString(),
      tenant: {
        id: row.tenant.id,
        slug: row.tenant.slug,
        name: row.tenant.name,
        plan: row.tenant.plan,
        status: row.tenant.status,
        createdAt: row.tenant.createdAt.toISOString(),
      },
      paidInvoiceCount: paidMap.get(row.tenantId)?.count ?? 0,
      totalCommissionKrw: paidMap.get(row.tenantId)?.sum ?? 0,
    })),
  };
}

export async function listReferrerCommissions(
  referrerId: string,
  params?: { status?: PlatformReferrerCommissionStatus; limit?: number; offset?: number },
) {
  const where: Prisma.PlatformReferrerCommissionAccrualWhereInput = { referrerId };
  if (params?.status) where.status = params.status;
  const limit = Math.min(params?.limit ?? 50, 100);
  const offset = params?.offset ?? 0;

  const [items, total] = await Promise.all([
    prisma.platformReferrerCommissionAccrual.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        tenant: { select: { id: true, slug: true, name: true } },
        invoice: { select: { id: true, plan: true, amountKrw: true, periodStart: true, paidAt: true } },
      },
    }),
    prisma.platformReferrerCommissionAccrual.count({ where }),
  ]);

  return {
    total,
    items: items.map((row) => ({
      id: row.id,
      tenant: row.tenant,
      invoice: {
        id: row.invoice.id,
        plan: row.invoice.plan,
        amountKrw: row.invoice.amountKrw,
        periodStart: row.invoice.periodStart.toISOString(),
        paidAt: row.invoice.paidAt?.toISOString() ?? null,
      },
      periodYm: row.periodYm,
      invoicePaidAmount: row.invoicePaidAmount,
      commissionRateBps: row.commissionRateBps,
      commissionAmount: row.commissionAmount,
      status: row.status,
      paidAt: row.paidAt?.toISOString() ?? null,
      paidMemo: row.paidMemo,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function updateReferrerCommissionStatuses(input: {
  referrerId: string;
  accrualIds: string[];
  status: PlatformReferrerCommissionStatus;
  paidMemo?: string | null;
}) {
  if (!input.accrualIds.length) throw new PlatformReferrerError('처리할 적립 건을 선택해 주세요.');

  const rows = await prisma.platformReferrerCommissionAccrual.findMany({
    where: { id: { in: input.accrualIds }, referrerId: input.referrerId },
    select: { id: true, status: true },
  });
  if (rows.length !== input.accrualIds.length) {
    throw new PlatformReferrerError('일부 적립 건을 찾을 수 없습니다.');
  }

  const now = new Date();
  await prisma.platformReferrerCommissionAccrual.updateMany({
    where: { id: { in: input.accrualIds }, referrerId: input.referrerId },
    data: {
      status: input.status,
      paidAt: input.status === 'PAID' ? now : null,
      paidMemo: input.paidMemo?.trim() || null,
    },
  });

  return { updated: rows.length };
}
