import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { inquiryActiveOnlyWhere } from '../inquiries/inquiryTrash.helpers.js';
import {
  createTenantInquiryShareInTransaction,
  TenantInquiryShareError,
} from '../tenant-partners/tenantInquiryShare.service.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { notifyTenantShareReceived } from '../tenant-partners/tenantInquiryShareNotify.js';
import { noActiveSourceShareWhere } from '../tenant-partners/tenantInquirySharePick.helpers.js';
import {
  backfillSourceInquiryFromOrderFormForMigration,
  fullSyncShareMirrorFromSourceInTransaction,
  resyncExternalLegacyMigratedMirrors,
} from '../tenant-partners/tenantInquiryShareMirrorSync.helpers.js';

/** HTTP 타임아웃 방지 — 1회 요청당 최대 이관 건수 */
export const EXTERNAL_MIGRATION_BATCH_MAX = 40;

export class ExternalToPartnerMigrationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ExternalToPartnerMigrationError';
  }
}

export async function countActiveExternalLegacySharesForCompany(
  tenantId: string,
  externalCompanyId: string,
): Promise<number> {
  return prisma.tenantInquiryShare.count({
    where: {
      sourceTenantId: tenantId,
      syncStatus: 'ACTIVE',
      settlementMode: 'EXTERNAL_LEGACY',
      settlementExternalCompanyId: externalCompanyId,
    },
  });
}

export async function getExternalCompanyMigrationStatus(opts: {
  tenantId: string;
  externalCompanyId: string;
}) {
  const company = await prisma.externalCompany.findFirst({
    where: { id: opts.externalCompanyId, tenantId: opts.tenantId, isActive: true },
    include: {
      linkedPartnerTenant: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!company) {
    throw new ExternalToPartnerMigrationError('타업체를 찾을 수 없습니다.', 404);
  }

  const [migratedCount, eligible, partnershipActive] = await Promise.all([
    countActiveExternalLegacySharesForCompany(opts.tenantId, company.id),
    listMigrationEligibleInquiries({
      tenantId: opts.tenantId,
      externalCompanyId: company.id,
    }),
    company.linkedPartnerTenantId
      ? resolveActivePartnershipId(opts.tenantId, company.linkedPartnerTenantId).then(
          (id) => ({ ok: true as const, partnershipId: id }),
          () => ({ ok: false as const, partnershipId: null }),
        )
      : Promise.resolve({ ok: false as const, partnershipId: null }),
  ]);

  const mismatchedShareCount =
    company.linkedPartnerTenantId != null
      ? await prisma.tenantInquiryShare.count({
          where: {
            sourceTenantId: opts.tenantId,
            syncStatus: 'ACTIVE',
            settlementMode: 'EXTERNAL_LEGACY',
            settlementExternalCompanyId: company.id,
            targetTenantId: { not: company.linkedPartnerTenantId },
          },
        })
      : 0;

  return {
    externalCompanyId: company.id,
    externalCompanyName: company.name,
    linkedPartnerTenant: company.linkedPartnerTenant,
    promotedAt: company.promotedAt?.toISOString() ?? null,
    usageDisabled: company.usageDisabledAt != null,
    partnershipActive: partnershipActive.ok,
    migratedCount,
    eligibleCount: eligible.length,
    mismatchedShareCount,
  };
}

async function assertPartnerLinkChangeAllowed(
  tenantId: string,
  company: { id: string; linkedPartnerTenantId: string | null },
  nextPartnerTenantId: string,
): Promise<void> {
  if (
    company.linkedPartnerTenantId &&
    company.linkedPartnerTenantId !== nextPartnerTenantId
  ) {
    const migratedCount = await countActiveExternalLegacySharesForCompany(tenantId, company.id);
    if (migratedCount > 0) {
      throw new ExternalToPartnerMigrationError(
        `이미 ${migratedCount}건이 파트너 DB로 이관되었습니다. 연결된 파트너 업체를 바꿀 수 없습니다.`,
      );
    }
  }
}

export type MigrationEligibleInquiry = {
  id: string;
  inquiryNumber: string | null;
  customerName: string;
  preferredDate: string | null;
  status: string;
  externalTransferFee: number | null;
  operatingCompanyId: string;
};

export async function resolveActivePartnershipId(
  ownerTenantId: string,
  partnerTenantId: string,
): Promise<string> {
  const partnership = await prisma.tenantPartnership.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { tenantLowId: ownerTenantId, tenantHighId: partnerTenantId },
        { tenantHighId: ownerTenantId, tenantLowId: partnerTenantId },
      ],
    },
    select: { id: true },
  });
  if (!partnership) {
    throw new ExternalToPartnerMigrationError(
      'ACTIVE 파트너십이 없습니다. 파트너 연결 메뉴에서 먼저 승인해 주세요.',
    );
  }
  return partnership.id;
}

export async function linkExternalCompanyToPartnerTenant(opts: {
  tenantId: string;
  externalCompanyId: string;
  partnerTenantId: string;
}) {
  const { tenantId, externalCompanyId, partnerTenantId } = opts;
  if (partnerTenantId === tenantId) {
    throw new ExternalToPartnerMigrationError('자사 테넌트는 파트너로 연결할 수 없습니다.');
  }

  const company = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, tenantId, isActive: true },
  });
  if (!company) {
    throw new ExternalToPartnerMigrationError('타업체를 찾을 수 없습니다.', 404);
  }

  const partnerTenant = await prisma.tenant.findFirst({
    where: { id: partnerTenantId, status: 'ACTIVE' },
    select: { id: true, name: true, slug: true },
  });
  if (!partnerTenant) {
    throw new ExternalToPartnerMigrationError('파트너 업체(테넌트)를 찾을 수 없습니다.', 404);
  }

  await assertPartnerLinkChangeAllowed(tenantId, company, partnerTenantId);
  await resolveActivePartnershipId(tenantId, partnerTenantId);

  const updated = await prisma.externalCompany.update({
    where: { id: company.id },
    data: {
      linkedPartnerTenantId: partnerTenantId,
      promotedAt: company.promotedAt ?? new Date(),
    },
    include: {
      linkedPartnerTenant: { select: { id: true, name: true, slug: true } },
    },
  });

  return {
    externalCompanyId: updated.id,
    linkedPartnerTenant: updated.linkedPartnerTenant,
    promotedAt: updated.promotedAt?.toISOString() ?? null,
  };
}

export async function listMigrationEligibleInquiries(opts: {
  tenantId: string;
  externalCompanyId: string;
  operatingCompanyId?: string;
}): Promise<MigrationEligibleInquiry[]> {
  const company = await prisma.externalCompany.findFirst({
    where: { id: opts.externalCompanyId, tenantId: opts.tenantId, isActive: true },
    select: { id: true },
  });
  if (!company) {
    throw new ExternalToPartnerMigrationError('타업체를 찾을 수 없습니다.', 404);
  }

  const ocId = opts.operatingCompanyId?.trim();
  const rows = await prisma.inquiry.findMany({
    where: {
      tenantId: opts.tenantId,
      ...inquiryActiveOnlyWhere(),
      externalTransferFee: { not: null },
      ...(ocId ? { operatingCompanyId: ocId } : {}),
      ...noActiveSourceShareWhere,
      OR: [
        {
          assignments: {
            some: {
              teamLeader: {
                role: 'EXTERNAL_PARTNER',
                externalCompanyId: opts.externalCompanyId,
              },
            },
          },
        },
        { cancelFeeExternalCompanyId: opts.externalCompanyId },
      ],
    },
    orderBy: [{ preferredDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      preferredDate: true,
      status: true,
      externalTransferFee: true,
      operatingCompanyId: true,
      assignments: {
        where: {
          teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: opts.externalCompanyId },
        },
        select: { id: true },
      },
    },
  });

  return rows
    .filter((row) => row.assignments.length > 0 || row.status === 'CANCELLED')
    .map((row) => ({
      id: row.id,
      inquiryNumber: row.inquiryNumber,
      customerName: row.customerName,
      preferredDate: row.preferredDate ? row.preferredDate.toISOString() : null,
      status: row.status,
      externalTransferFee: row.externalTransferFee,
      operatingCompanyId: row.operatingCompanyId,
    }));
}

async function migrateOneInquiryInTransaction(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string;
    userId: string;
    externalCompanyId: string;
    partnershipId: string;
    partnerTenantId: string;
    inquiryId: string;
  },
) {
  const source = await tx.inquiry.findFirst({
    where: { id: opts.inquiryId, tenantId: opts.tenantId, ...inquiryActiveOnlyWhere() },
  });
  if (!source) {
    throw new ExternalToPartnerMigrationError('접수를 찾을 수 없습니다.', 404);
  }
  if (source.externalTransferFee == null) {
    throw new ExternalToPartnerMigrationError('타업체 수수료가 없는 접수는 이관할 수 없습니다.');
  }

  const sourceForMirror = await backfillSourceInquiryFromOrderFormForMigration(tx, source);

  const existingShare = await tx.tenantInquiryShare.findFirst({
    where: { sourceInquiryId: source.id, syncStatus: 'ACTIVE' },
  });
  if (existingShare) {
    throw new ExternalToPartnerMigrationError('이미 파트너 연계된 접수입니다.');
  }

  const hasAssignment = await tx.assignment.count({
    where: {
      inquiryId: source.id,
      teamLeader: {
        tenantId: opts.tenantId,
        role: 'EXTERNAL_PARTNER',
        externalCompanyId: opts.externalCompanyId,
      },
    },
  });
  if (hasAssignment === 0 && source.status !== 'CANCELLED') {
    throw new ExternalToPartnerMigrationError('해당 타업체 배정이 없는 접수입니다.');
  }

  const now = new Date();
  const result = await createTenantInquiryShareInTransaction(tx, {
    viewerTenantId: opts.tenantId,
    viewerUserId: opts.userId,
    inquiryId: sourceForMirror.id,
    partnershipId: opts.partnershipId,
    transferFee: sourceForMirror.externalTransferFee,
    settlementMode: 'EXTERNAL_LEGACY',
    settlementExternalCompanyId: opts.externalCompanyId,
    migratedFromExternalAt: now,
    migratedByUserId: opts.userId,
    skipExternalPartnerCheck: true,
  });

  await fullSyncShareMirrorFromSourceInTransaction(
    tx,
    {
      sourceInquiryId: sourceForMirror.id,
      targetInquiryId: result.targetInquiryId,
      syncFieldMask: result.shareRow.syncFieldMask,
      settlementMode: result.shareRow.settlementMode,
      transferFee: result.shareRow.transferFee,
    },
    { ignoreFieldMask: true },
  );

  if (result.shareRow.settlementExternalCompanyId !== opts.externalCompanyId) {
    throw new ExternalToPartnerMigrationError('이관 share 정산 연결 검증에 실패했습니다.');
  }
  if (result.targetTenantId !== opts.partnerTenantId) {
    throw new ExternalToPartnerMigrationError('파트너 mirror 테넌트가 연결된 업체와 일치하지 않습니다.');
  }
  if (result.shareRow.transferFee !== sourceForMirror.externalTransferFee) {
    throw new ExternalToPartnerMigrationError('이관 수수료가 원본과 일치하지 않습니다.');
  }

  await tx.assignment.deleteMany({
    where: {
      inquiryId: source.id,
      teamLeader: {
        role: 'EXTERNAL_PARTNER',
        externalCompanyId: opts.externalCompanyId,
      },
    },
  });

  return {
    inquiryId: source.id,
    inquiryNumber: source.inquiryNumber,
    shareId: result.share.id,
    targetInquiryId: result.targetInquiryId,
    targetInquiryNumber: result.targetInquiryNumber,
    transferFee: sourceForMirror.externalTransferFee,
    removedInternalLeaderIds: result.removedInternalLeaderIds,
    notify: {
      targetTenantId: opts.partnerTenantId,
      targetInquiryId: result.targetInquiryId,
      customerName: sourceForMirror.customerName,
      partnerName: result.partnerName,
      sourceInquiryNumberSnapshot: sourceForMirror.inquiryNumber,
      targetInquiryNumber: result.targetInquiryNumber,
    },
  };
}

export { resyncExternalLegacyMigratedMirrors };

export async function migrateExternalInquiriesToHybridPartner(opts: {
  tenantId: string;
  userId: string;
  externalCompanyId: string;
  inquiryIds?: string[];
  allEligible?: boolean;
  dryRun?: boolean;
  batchLimit?: number;
}) {
  const company = await prisma.externalCompany.findFirst({
    where: { id: opts.externalCompanyId, tenantId: opts.tenantId, isActive: true },
    include: {
      linkedPartnerTenant: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!company) {
    throw new ExternalToPartnerMigrationError('타업체를 찾을 수 없습니다.', 404);
  }
  if (company.usageDisabledAt != null) {
    throw new ExternalToPartnerMigrationError(
      '사용 중지된 타업체는 DB 이관을 실행할 수 없습니다. 사용 중으로 전환한 뒤 진행하세요.',
    );
  }
  if (!company.linkedPartnerTenantId || !company.linkedPartnerTenant) {
    throw new ExternalToPartnerMigrationError(
      '파트너 테넌트 연결이 필요합니다. 먼저 「파트너 연결」을 설정해 주세요.',
    );
  }

  const partnershipId = await resolveActivePartnershipId(
    opts.tenantId,
    company.linkedPartnerTenantId,
  );

  const mismatchedShareCount = await prisma.tenantInquiryShare.count({
    where: {
      sourceTenantId: opts.tenantId,
      syncStatus: 'ACTIVE',
      settlementMode: 'EXTERNAL_LEGACY',
      settlementExternalCompanyId: company.id,
      targetTenantId: { not: company.linkedPartnerTenantId },
    },
  });
  if (mismatchedShareCount > 0) {
    throw new ExternalToPartnerMigrationError(
      `이관 이력 ${mismatchedShareCount}건이 현재 연결된 파트너와 다릅니다. 파트너 연결을 확인한 뒤 다시 시도해 주세요.`,
    );
  }

  const eligible = await listMigrationEligibleInquiries({
    tenantId: opts.tenantId,
    externalCompanyId: opts.externalCompanyId,
  });
  const eligibleIds = new Set(eligible.map((e) => e.id));

  const batchLimit = Math.min(
    EXTERNAL_MIGRATION_BATCH_MAX,
    Math.max(1, Math.trunc(opts.batchLimit ?? EXTERNAL_MIGRATION_BATCH_MAX)),
  );

  let targetIds: string[];
  if (opts.allEligible) {
    targetIds = [...eligibleIds].slice(0, batchLimit);
  } else {
    const requested = [...new Set((opts.inquiryIds ?? []).map((id) => id.trim()).filter(Boolean))];
    if (requested.length === 0) {
      throw new ExternalToPartnerMigrationError('이관할 접수를 선택해 주세요.');
    }
    const invalid = requested.filter((id) => !eligibleIds.has(id));
    if (invalid.length > 0) {
      throw new ExternalToPartnerMigrationError(
        `이관할 수 없는 접수가 ${invalid.length}건 있습니다. 목록을 다시 확인해 주세요.`,
      );
    }
    targetIds = requested;
  }

  const previewItems = eligible.filter((e) => targetIds.includes(e.id));
  const feeTotal = previewItems.reduce((sum, row) => sum + (row.externalTransferFee ?? 0), 0);

  if (opts.dryRun) {
    return {
      dryRun: true as const,
      externalCompanyId: company.id,
      externalCompanyName: company.name,
      partnerTenant: company.linkedPartnerTenant,
      count: previewItems.length,
      feeTotal,
      batchLimit,
      totalEligibleCount: eligible.length,
      remainingEligibleCount: Math.max(0, eligible.length - previewItems.length),
      migratedShareCount: await countActiveExternalLegacySharesForCompany(
        opts.tenantId,
        company.id,
      ),
      items: previewItems,
      migrated: [] as Array<{
        inquiryId: string;
        inquiryNumber: string | null;
        shareId: string;
        targetInquiryId: string;
        targetInquiryNumber: string | null;
        transferFee: number | null;
      }>,
      errors: [] as Array<{ inquiryId: string; error: string }>,
    };
  }

  const migrated: Array<{
    inquiryId: string;
    inquiryNumber: string | null;
    shareId: string;
    targetInquiryId: string;
    targetInquiryNumber: string | null;
    transferFee: number | null;
  }> = [];
  const errors: Array<{ inquiryId: string; error: string }> = [];

  for (const inquiryId of targetIds) {
    try {
      const row = await prisma.$transaction((tx) =>
        migrateOneInquiryInTransaction(tx, {
          tenantId: opts.tenantId,
          userId: opts.userId,
          externalCompanyId: company.id,
          partnershipId,
          partnerTenantId: company.linkedPartnerTenantId!,
          inquiryId,
        }),
      );
      if (row.notify) {
        await notifyTenantShareReceived(row.notify);
      }
      if (row.removedInternalLeaderIds.length > 0) {
        void notifyInboxRefresh(row.removedInternalLeaderIds);
      }
      migrated.push({
        inquiryId: row.inquiryId,
        inquiryNumber: row.inquiryNumber,
        shareId: row.shareId,
        targetInquiryId: row.targetInquiryId,
        targetInquiryNumber: row.targetInquiryNumber,
        transferFee: row.transferFee,
      });
    } catch (e) {
      const message =
        e instanceof TenantInquiryShareError || e instanceof ExternalToPartnerMigrationError
          ? e.message
          : e instanceof Error
            ? e.message
            : '이관 실패';
      errors.push({ inquiryId, error: message });
    }
  }

  const migratedIds = new Set(migrated.map((m) => m.inquiryId));
  const remainingEligibleCount = eligible.filter((e) => !migratedIds.has(e.id)).length;

  return {
    dryRun: false as const,
    externalCompanyId: company.id,
    externalCompanyName: company.name,
    partnerTenant: company.linkedPartnerTenant,
    count: previewItems.length,
    feeTotal,
    batchLimit,
    totalEligibleCount: eligible.length,
    remainingEligibleCount,
    migratedShareCount: await countActiveExternalLegacySharesForCompany(opts.tenantId, company.id),
    items: previewItems,
    migrated,
    errors,
  };
}
