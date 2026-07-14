import type {
  Prisma,
  TenantPartnership,
  TenantPartnershipStatus,
  TenantPartnershipSuspendedBy,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  assertTenantStaffLoginAllowed,
  resolveTenantBySlug,
  TenantNotFoundError,
  TenantSuspendedError,
} from '../tenants/tenant.service.js';

export class TenantPartnershipError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'TenantPartnershipError';
  }
}

/** tenantLowId < tenantHighId (UUID 문자열 비교) */
export function normalizeTenantPairId(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export function isViewerLowSide(row: TenantPartnership, viewerTenantId: string): boolean {
  return row.tenantLowId === viewerTenantId;
}

function partnershipInclude() {
  return {
    tenantLow: { select: { id: true, slug: true, name: true, status: true } },
    tenantHigh: { select: { id: true, slug: true, name: true, status: true } },
    requestedBy: { select: { id: true, slug: true, name: true } },
  } satisfies Prisma.TenantPartnershipInclude;
}

type PartnershipRow = Prisma.TenantPartnershipGetPayload<{ include: ReturnType<typeof partnershipInclude> }>;

export type SerializedTenantPartnership = {
  id: string;
  status: TenantPartnershipStatus;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  suspendedBy: TenantPartnershipSuspendedBy | null;
  requestedByTenantId: string;
  partner: { id: string; slug: string; name: string; status: string };
  myAcceptedAt: string | null;
  partnerAcceptedAt: string | null;
  needsMyAcceptance: boolean;
  canAccept: boolean;
  canReject: boolean;
  canSuspend: boolean;
};

export function serializePartnership(row: PartnershipRow, viewerTenantId: string): SerializedTenantPartnership {
  const iAmLow = row.tenantLowId === viewerTenantId;
  const partner = iAmLow ? row.tenantHigh : row.tenantLow;
  const myAcceptedAt = iAmLow ? row.lowAcceptedAt : row.highAcceptedAt;
  const partnerAcceptedAt = iAmLow ? row.highAcceptedAt : row.lowAcceptedAt;
  const needsMyAcceptance = row.status === 'PENDING' && !myAcceptedAt;
  const canAccept = row.status === 'PENDING' && needsMyAcceptance;
  const canReject = row.status === 'PENDING';
  const canSuspend = row.status === 'ACTIVE';

  return {
    id: row.id,
    status: row.status,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
    suspendedBy: row.suspendedBy,
    requestedByTenantId: row.requestedByTenantId,
    partner: {
      id: partner.id,
      slug: partner.slug,
      name: partner.name,
      status: partner.status,
    },
    myAcceptedAt: myAcceptedAt?.toISOString() ?? null,
    partnerAcceptedAt: partnerAcceptedAt?.toISOString() ?? null,
    needsMyAcceptance,
    canAccept,
    canReject,
    canSuspend,
  };
}

async function assertPartnershipMember(
  partnershipId: string,
  viewerTenantId: string,
): Promise<PartnershipRow> {
  const row = await prisma.tenantPartnership.findFirst({
    where: {
      id: partnershipId,
      OR: [{ tenantLowId: viewerTenantId }, { tenantHighId: viewerTenantId }],
    },
    include: partnershipInclude(),
  });
  if (!row) {
    throw new TenantPartnershipError('파트너십을 찾을 수 없습니다.', 404);
  }
  return row;
}

async function assertPartnerTenantAvailable(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, status: true, suspendReason: true, billingAccessBlockedAt: true },
  });
  if (!t) throw new TenantPartnershipError('상대 업체를 찾을 수 없습니다.', 404);
  try {
    await assertTenantStaffLoginAllowed(t);
  } catch (e) {
    if (e instanceof TenantSuspendedError) {
      throw new TenantPartnershipError('서비스가 중지된 업체와는 파트너십을 맺을 수 없습니다.', 400);
    }
    throw e;
  }
}

function maybeActivate(row: { lowAcceptedAt: Date | null; highAcceptedAt: Date | null }): TenantPartnershipStatus {
  return row.lowAcceptedAt && row.highAcceptedAt ? 'ACTIVE' : 'PENDING';
}

export async function lookupPartnerTenantBySlug(viewerTenantId: string, slugRaw: string) {
  let partner;
  try {
    partner = await resolveTenantBySlug(slugRaw);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      throw new TenantPartnershipError(e.message, 404);
    }
    throw e;
  }
  if (partner.id === viewerTenantId) {
    throw new TenantPartnershipError('자기 업체 코드는 등록할 수 없습니다.', 400);
  }
  await assertPartnerTenantAvailable(partner.id);
  return { slug: partner.slug, name: partner.name, status: partner.status };
}

export async function listPartnershipsForTenant(viewerTenantId: string) {
  const rows = await prisma.tenantPartnership.findMany({
    where: {
      OR: [{ tenantLowId: viewerTenantId }, { tenantHighId: viewerTenantId }],
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: partnershipInclude(),
  });
  return rows.map((r) => serializePartnership(r, viewerTenantId));
}

export async function requestPartnership(viewerTenantId: string, partnerSlug: string, memo?: string) {
  const partner = await lookupPartnerTenantBySlug(viewerTenantId, partnerSlug);
  const partnerRow = await prisma.tenant.findUniqueOrThrow({ where: { slug: partner.slug } });
  const { low, high } = normalizeTenantPairId(viewerTenantId, partnerRow.id);
  const now = new Date();
  const existing = await prisma.tenantPartnership.findUnique({
    where: { tenantLowId_tenantHighId: { tenantLowId: low, tenantHighId: high } },
    include: partnershipInclude(),
  });

  if (existing) {
    if (existing.status === 'ACTIVE') {
      throw new TenantPartnershipError('이미 접수 연계 파트너로 연결된 업체입니다.', 400);
    }
    if (existing.status === 'PENDING') {
      throw new TenantPartnershipError('이미 파트너 요청이 진행 중입니다.', 400);
    }
    if (existing.status === 'SUSPENDED') {
      throw new TenantPartnershipError('중지된 파트너십입니다. 플랫폼 또는 재협의 후 다시 요청해 주세요.', 400);
    }
    // REJECTED → 재요청
    const patch: Prisma.TenantPartnershipUpdateInput = {
      status: 'PENDING',
      requestedBy: { connect: { id: viewerTenantId } },
      suspendedAt: null,
      suspendedBy: null,
      memo: memo?.trim() || null,
      lowAcceptedAt: viewerTenantId === low ? now : null,
      highAcceptedAt: viewerTenantId === high ? now : null,
    };
    const updated = await prisma.tenantPartnership.update({
      where: { id: existing.id },
      data: patch,
      include: partnershipInclude(),
    });
    return serializePartnership(updated, viewerTenantId);
  }

  const created = await prisma.tenantPartnership.create({
    data: {
      tenantLowId: low,
      tenantHighId: high,
      status: 'PENDING',
      requestedByTenantId: viewerTenantId,
      lowAcceptedAt: viewerTenantId === low ? now : null,
      highAcceptedAt: viewerTenantId === high ? now : null,
      memo: memo?.trim() || null,
    },
    include: partnershipInclude(),
  });
  return serializePartnership(created, viewerTenantId);
}

export async function acceptPartnership(partnershipId: string, viewerTenantId: string) {
  const row = await assertPartnershipMember(partnershipId, viewerTenantId);
  if (row.status !== 'PENDING') {
    throw new TenantPartnershipError('승인할 수 있는 상태가 아닙니다.', 400);
  }
  const iAmLow = row.tenantLowId === viewerTenantId;
  if (iAmLow ? row.lowAcceptedAt : row.highAcceptedAt) {
    throw new TenantPartnershipError('이미 승인하셨습니다. 상대 업체의 승인을 기다려 주세요.', 400);
  }
  await assertPartnerTenantAvailable(iAmLow ? row.tenantHighId : row.tenantLowId);

  const now = new Date();
  const lowAcceptedAt = iAmLow ? now : row.lowAcceptedAt;
  const highAcceptedAt = iAmLow ? row.highAcceptedAt : now;
  const updated = await prisma.tenantPartnership.update({
    where: { id: row.id },
    data: {
      lowAcceptedAt,
      highAcceptedAt,
      status: maybeActivate({ lowAcceptedAt, highAcceptedAt }),
    },
    include: partnershipInclude(),
  });
  return serializePartnership(updated, viewerTenantId);
}

export async function rejectPartnership(partnershipId: string, viewerTenantId: string) {
  const row = await assertPartnershipMember(partnershipId, viewerTenantId);
  if (row.status !== 'PENDING') {
    throw new TenantPartnershipError('거절할 수 있는 상태가 아닙니다.', 400);
  }
  const updated = await prisma.tenantPartnership.update({
    where: { id: row.id },
    data: { status: 'REJECTED', lowAcceptedAt: null, highAcceptedAt: null },
    include: partnershipInclude(),
  });
  return serializePartnership(updated, viewerTenantId);
}

export async function suspendPartnership(partnershipId: string, viewerTenantId: string) {
  const row = await assertPartnershipMember(partnershipId, viewerTenantId);
  if (row.status !== 'ACTIVE') {
    throw new TenantPartnershipError('중지할 수 있는 상태가 아닙니다.', 400);
  }
  const suspendedBy: TenantPartnershipSuspendedBy = isViewerLowSide(row, viewerTenantId)
    ? 'TENANT_LOW'
    : 'TENANT_HIGH';
  const updated = await prisma.tenantPartnership.update({
    where: { id: row.id },
    data: {
      status: 'SUSPENDED',
      suspendedAt: new Date(),
      suspendedBy,
    },
    include: partnershipInclude(),
  });
  return serializePartnership(updated, viewerTenantId);
}
