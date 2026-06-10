import type { TenantPartnershipStatus, TenantPartnershipSuspendedBy } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type PlatformTenantPartnershipItem = {
  id: string;
  status: TenantPartnershipStatus;
  suspendedAt: string | null;
  suspendedBy: TenantPartnershipSuspendedBy | null;
  createdAt: string;
  updatedAt: string;
  tenantLow: { id: string; slug: string; name: string; status: string };
  tenantHigh: { id: string; slug: string; name: string; status: string };
  shareCount: number;
  activeShareCount: number;
  pausedShareCount: number;
};

export async function listTenantPartnershipsForPlatform(): Promise<PlatformTenantPartnershipItem[]> {
  const rows = await prisma.tenantPartnership.findMany({
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: {
      tenantLow: { select: { id: true, slug: true, name: true, status: true } },
      tenantHigh: { select: { id: true, slug: true, name: true, status: true } },
      inquiryShares: { select: { syncStatus: true } },
    },
  });

  return rows.map((row) => {
    const shareCount = row.inquiryShares.length;
    const activeShareCount = row.inquiryShares.filter((s) => s.syncStatus === 'ACTIVE').length;
    const pausedShareCount = row.inquiryShares.filter((s) => s.syncStatus === 'PAUSED').length;
    return {
      id: row.id,
      status: row.status,
      suspendedAt: row.suspendedAt?.toISOString() ?? null,
      suspendedBy: row.suspendedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      tenantLow: row.tenantLow,
      tenantHigh: row.tenantHigh,
      shareCount,
      activeShareCount,
      pausedShareCount,
    };
  });
}

export class PlatformTenantPartnershipError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'PlatformTenantPartnershipError';
  }
}

export async function platformSuspendTenantPartnership(partnershipId: string) {
  const row = await prisma.tenantPartnership.findUnique({ where: { id: partnershipId } });
  if (!row) throw new PlatformTenantPartnershipError('파트너십을 찾을 수 없습니다.', 404);
  if (row.status === 'SUSPENDED') {
    throw new PlatformTenantPartnershipError('이미 중지된 파트너십입니다.');
  }
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const partnership = await tx.tenantPartnership.update({
      where: { id: partnershipId },
      data: {
        status: 'SUSPENDED',
        suspendedAt: now,
        suspendedBy: 'PLATFORM',
      },
      include: {
        tenantLow: { select: { id: true, slug: true, name: true, status: true } },
        tenantHigh: { select: { id: true, slug: true, name: true, status: true } },
        inquiryShares: { select: { syncStatus: true } },
      },
    });
    await tx.tenantInquiryShare.updateMany({
      where: { partnershipId, syncStatus: 'ACTIVE' },
      data: { syncStatus: 'PAUSED' },
    });
    return partnership;
  });
  return updated;
}

export async function platformResumeTenantPartnership(partnershipId: string) {
  const row = await prisma.tenantPartnership.findUnique({ where: { id: partnershipId } });
  if (!row) throw new PlatformTenantPartnershipError('파트너십을 찾을 수 없습니다.', 404);
  if (row.status !== 'SUSPENDED') {
    throw new PlatformTenantPartnershipError('중지된 파트너십만 재개할 수 있습니다.');
  }
  if (!row.lowAcceptedAt || !row.highAcceptedAt) {
    throw new PlatformTenantPartnershipError('양쪽 승인이 완료되지 않아 재개할 수 없습니다.');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const partnership = await tx.tenantPartnership.update({
      where: { id: partnershipId },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspendedBy: null,
      },
      include: {
        tenantLow: { select: { id: true, slug: true, name: true, status: true } },
        tenantHigh: { select: { id: true, slug: true, name: true, status: true } },
        inquiryShares: { select: { syncStatus: true } },
      },
    });
    await tx.tenantInquiryShare.updateMany({
      where: { partnershipId, syncStatus: 'PAUSED' },
      data: { syncStatus: 'ACTIVE' },
    });
    return partnership;
  });
  return updated;
}
