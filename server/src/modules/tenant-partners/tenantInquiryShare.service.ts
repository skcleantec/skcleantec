import type { Inquiry, Prisma, TenantInquiryShareDirection } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { loadMarketplaceConfirmedShareIdSet } from '../db-marketplace/dbMarketplaceSettlementMeta.js';
import { allocateNextInquiryNumber } from '../inquiries/inquiryNumber.js';
import { getDefaultOperatingCompanyId } from '../operating-companies/operatingCompany.service.js';
import {
  applyFieldMaskToMirrorData,
  normalizeShareFieldMask,
  shareMaskFromPreset,
} from './tenantInquiryShareFields.js';
import { copyExistingConsultationPhotosToShareMirror } from './tenantInquiryPhotoSync.service.js';
import { notifyTenantShareReceived, notifyTenantShareRevoked } from './tenantInquiryShareNotify.js';
import {
  assertNoExternalPartnerForPartnerShare,
  MSG_EXTERNAL_BLOCKS_PARTNER_SHARE,
} from '../inquiries/inquiryExternalPartnerShareMutex.js';
import {
  computeSourceMirrorBalanceAmount,
  computeTargetMirrorBalanceAmount,
} from './tenantInquiryShareBalance.helpers.js';
import { clearInternalInquiryAssignments } from '../assignments/clearInternalInquiryAssignments.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

export class TenantInquiryShareError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'TenantInquiryShareError';
  }
}

export type SerializedTenantInquiryShareMeta = {
  id: string;
  role: 'SOURCE' | 'TARGET';
  partnerTenantId: string;
  partnerName: string;
  partnerSlug: string;
  transferFee: number | null;
  sourceInquiryNumberSnapshot: string | null;
  sharedAt: string;
  syncStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  /** 정보공유(마켓) 확정 후 생성된 share */
  viaMarketplace: boolean;
  settlementMode: 'PARTNER_NATIVE' | 'EXTERNAL_LEGACY';
  settlementExternalCompanyId: string | null;
};

type ShareRow = {
  id: string;
  sourceTenantId: string;
  sourceInquiryId: string;
  targetTenantId: string;
  targetInquiryId: string;
  transferFee: number | null;
  sourceInquiryNumberSnapshot: string | null;
  sharedAt: Date;
  syncStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  settlementMode: 'PARTNER_NATIVE' | 'EXTERNAL_LEGACY';
  settlementExternalCompanyId: string | null;
  partnership: {
    tenantLow: { id: string; slug: string; name: string };
    tenantHigh: { id: string; slug: string; name: string };
  };
};

function partnerFromShare(row: ShareRow, viewerTenantId: string) {
  const iAmSource = row.sourceTenantId === viewerTenantId;
  const iAmLow = row.partnership.tenantLow.id === viewerTenantId;
  const partner = iAmLow ? row.partnership.tenantHigh : row.partnership.tenantLow;
  return {
    role: iAmSource ? ('SOURCE' as const) : ('TARGET' as const),
    partner,
  };
}

export function serializeShareMeta(
  row: ShareRow,
  viewerTenantId: string,
  opts?: { viaMarketplace?: boolean },
): SerializedTenantInquiryShareMeta {
  const { role, partner } = partnerFromShare(row, viewerTenantId);
  return {
    id: row.id,
    role,
    partnerTenantId: partner.id,
    partnerName: partner.name,
    partnerSlug: partner.slug,
    transferFee: row.transferFee,
    sourceInquiryNumberSnapshot: row.sourceInquiryNumberSnapshot,
    sharedAt: row.sharedAt.toISOString(),
    syncStatus: row.syncStatus,
    viaMarketplace: opts?.viaMarketplace ?? false,
    settlementMode: row.settlementMode,
    settlementExternalCompanyId: row.settlementExternalCompanyId,
  };
}

const shareMetaInclude = {
  partnership: {
    select: {
      tenantLow: { select: { id: true, slug: true, name: true } },
      tenantHigh: { select: { id: true, slug: true, name: true } },
    },
  },
} as const;

function buildMirrorInquiryUnchecked(
  source: Inquiry,
  targetTenantId: string,
  targetOperatingCompanyId: string,
  inquiryNumber: string,
): Prisma.InquiryUncheckedCreateInput {
  return {
    tenantId: targetTenantId,
    operatingCompanyId: targetOperatingCompanyId,
    inquiryNumber,
    customerName: source.customerName,
    nickname: source.nickname,
    customerPhone: source.customerPhone,
    customerPhone2: source.customerPhone2,
    address: source.address,
    addressDetail: source.addressDetail,
    addressGeoQuery: source.addressGeoQuery,
    addressGeoLat: source.addressGeoLat,
    addressGeoLng: source.addressGeoLng,
    areaPyeong: source.areaPyeong,
    areaBasis: source.areaBasis,
    exclusiveAreaSqm: source.exclusiveAreaSqm,
    propertyType: source.propertyType,
    isOneRoom: source.isOneRoom,
    roomCount: source.roomCount,
    bathroomCount: source.bathroomCount,
    balconyCount: source.balconyCount,
    kitchenCount: source.kitchenCount,
    preferredDate: source.preferredDate,
    preferredTime: source.preferredTime,
    betweenScheduleSlot: source.betweenScheduleSlot,
    preferredTimeDetail: source.preferredTimeDetail,
    callAttempt: source.callAttempt,
    memo: source.memo,
    claimMemo: source.claimMemo,
    status: source.status,
    source: '파트너연계',
    buildingType: source.buildingType,
    moveInDate: source.moveInDate,
    moveInDateUndecided: source.moveInDateUndecided,
    specialNotes: source.specialNotes,
    scheduleMemo: source.scheduleMemo,
    consultationMemo: source.consultationMemo,
    serviceTotalAmount: source.serviceTotalAmount,
    serviceDepositAmount: source.serviceDepositAmount,
    serviceBalanceAmount: source.serviceBalanceAmount,
  };
}

function resolveShareDirection(
  partnership: { tenantLowId: string; tenantHighId: string },
  senderTenantId: string,
): TenantInquiryShareDirection {
  return senderTenantId === partnership.tenantLowId ? 'LOW_TO_HIGH' : 'HIGH_TO_LOW';
}

export async function createTenantInquiryShareInTransaction(
  tx: Prisma.TransactionClient,
  opts: {
    viewerTenantId: string;
    viewerUserId: string;
    inquiryId: string;
    partnershipId: string;
    transferFee?: number | null;
    fieldMask?: unknown;
    fieldPreset?: unknown;
    settlementMode?: 'PARTNER_NATIVE' | 'EXTERNAL_LEGACY';
    settlementExternalCompanyId?: string | null;
    migratedFromExternalAt?: Date | null;
    migratedByUserId?: string | null;
    skipExternalPartnerCheck?: boolean;
    /** 정보공유 재판매 — mirror(연계 수신) 접수에서 하위 hop 인계 */
    allowResaleFromReceivedShare?: boolean;
    /** 정보공유 인계 — mirror 잔금을 고객 현장 수금액으로 유지(수수료 차감 안 함) */
    preserveCustomerBalanceForMarketplace?: boolean;
  },
) {
  const { viewerTenantId, viewerUserId, inquiryId, partnershipId } = opts;
  const settlementMode = opts.settlementMode ?? 'PARTNER_NATIVE';
  const transferFee =
    opts.transferFee === undefined || opts.transferFee === null ? null : Math.trunc(opts.transferFee);
  if (transferFee != null && (transferFee < 0 || !Number.isFinite(transferFee))) {
    throw new TenantInquiryShareError('수수료는 0 이상 정수로 입력해 주세요.');
  }
  if (settlementMode === 'EXTERNAL_LEGACY' && !opts.settlementExternalCompanyId?.trim()) {
    throw new TenantInquiryShareError('타업체 정산 연계 ID가 필요합니다.');
  }

  const partnership = await tx.tenantPartnership.findFirst({
    where: {
      id: partnershipId,
      OR: [{ tenantLowId: viewerTenantId }, { tenantHighId: viewerTenantId }],
    },
  });
  if (!partnership) {
    throw new TenantInquiryShareError('파트너십을 찾을 수 없습니다.', 404);
  }
  if (partnership.status !== 'ACTIVE') {
    throw new TenantInquiryShareError('ACTIVE 상태의 파트너에게만 접수를 연계할 수 있습니다.');
  }

  const source = await tx.inquiry.findFirst({
    where: { id: inquiryId, tenantId: viewerTenantId },
  });
  if (!source) {
    throw new TenantInquiryShareError('접수를 찾을 수 없습니다.', 404);
  }

  const existingAsSource = await tx.tenantInquiryShare.findFirst({
    where: { sourceInquiryId: inquiryId, syncStatus: 'ACTIVE' },
  });
  if (existingAsSource) {
    throw new TenantInquiryShareError('이미 다른 파트너에게 연계된 접수입니다.');
  }

  const existingAsTarget = await tx.tenantInquiryShare.findUnique({
    where: { targetInquiryId: inquiryId },
  });
  if (existingAsTarget && !opts.allowResaleFromReceivedShare) {
    throw new TenantInquiryShareError('연계받은 접수는 다시 연계할 수 없습니다.');
  }

  if (!opts.skipExternalPartnerCheck && settlementMode === 'PARTNER_NATIVE') {
    await assertNoExternalPartnerForPartnerShare(tx, viewerTenantId, inquiryId).catch((e) => {
      throw new TenantInquiryShareError(
        e instanceof Error ? e.message : MSG_EXTERNAL_BLOCKS_PARTNER_SHARE,
      );
    });
  }

  const removedInternalLeaderIds = await clearInternalInquiryAssignments(
    tx,
    viewerTenantId,
    inquiryId,
  );

  const targetTenantId =
    viewerTenantId === partnership.tenantLowId ? partnership.tenantHighId : partnership.tenantLowId;
  const direction = resolveShareDirection(partnership, viewerTenantId);
  const now = new Date();
  const syncFieldMask =
    normalizeShareFieldMask(opts.fieldMask) ?? shareMaskFromPreset(opts.fieldPreset);

  const targetOcId = await getDefaultOperatingCompanyId(tx, targetTenantId);
  const targetInquiryNumber = await allocateNextInquiryNumber(tx, targetTenantId, targetOcId);

  const mirrorData = applyFieldMaskToMirrorData(
    buildMirrorInquiryUnchecked(source, targetTenantId, targetOcId, targetInquiryNumber),
    syncFieldMask,
  );

  const mirror = await tx.inquiry.create({ data: mirrorData });

  const adjustedBalance = opts.preserveCustomerBalanceForMarketplace
    ? computeSourceMirrorBalanceAmount({
        serviceTotalAmount: source.serviceTotalAmount,
        serviceDepositAmount: source.serviceDepositAmount,
        serviceBalanceAmount: source.serviceBalanceAmount,
      })
    : computeTargetMirrorBalanceAmount({
        serviceTotalAmount: source.serviceTotalAmount,
        serviceDepositAmount: source.serviceDepositAmount,
        serviceBalanceAmount: source.serviceBalanceAmount,
        transferFee,
      });
  if (adjustedBalance != null) {
    await tx.inquiry.update({
      where: { id: mirror.id },
      data: { serviceBalanceAmount: adjustedBalance },
    });
  }

  const share = await tx.tenantInquiryShare.create({
    data: {
      partnershipId,
      sourceTenantId: viewerTenantId,
      sourceInquiryId: source.id,
      targetTenantId,
      targetInquiryId: mirror.id,
      direction,
      transferFee,
      sourceInquiryNumberSnapshot: source.inquiryNumber,
      sharedAt: now,
      sharedByUserId: viewerUserId,
      syncFieldMask: syncFieldMask ?? undefined,
      settlementMode,
      settlementExternalCompanyId:
        settlementMode === 'EXTERNAL_LEGACY' ? opts.settlementExternalCompanyId!.trim() : null,
      migratedFromExternalAt: opts.migratedFromExternalAt ?? null,
      migratedByUserId: opts.migratedByUserId ?? null,
    },
    include: shareMetaInclude,
  });

  await copyExistingConsultationPhotosToShareMirror(
    tx,
    source.id,
    mirror.id,
    targetTenantId,
    syncFieldMask,
  );

  const partnershipRow = await tx.tenantPartnership.findUniqueOrThrow({
    where: { id: partnershipId },
    include: {
      tenantLow: { select: { id: true, name: true } },
      tenantHigh: { select: { id: true, name: true } },
    },
  });
  const partnerName =
    partnershipRow.tenantLowId === viewerTenantId
      ? partnershipRow.tenantHigh.name
      : partnershipRow.tenantLow.name;

  return {
    share: serializeShareMeta(share, viewerTenantId),
    shareRow: share,
    mirror,
    targetInquiryId: mirror.id,
    targetInquiryNumber: mirror.inquiryNumber,
    source,
    partnerName,
    targetTenantId,
    removedInternalLeaderIds,
  };
}

export async function createTenantInquiryShare(opts: {
  viewerTenantId: string;
  viewerUserId: string;
  inquiryId: string;
  partnershipId: string;
  transferFee?: number | null;
  fieldMask?: unknown;
  fieldPreset?: unknown;
  allowResaleFromReceivedShare?: boolean;
  preserveCustomerBalanceForMarketplace?: boolean;
}) {
  const source = await prisma.inquiry.findFirst({
    where: { id: opts.inquiryId, tenantId: opts.viewerTenantId },
  });
  if (!source) {
    throw new TenantInquiryShareError('접수를 찾을 수 없습니다.', 404);
  }

  const result = await prisma.$transaction(async (tx) =>
    createTenantInquiryShareInTransaction(tx, {
      ...opts,
      settlementMode: 'PARTNER_NATIVE',
    }),
  );

  await notifyTenantShareReceived({
    targetTenantId: result.targetTenantId,
    targetInquiryId: result.mirror.id,
    customerName: source.customerName,
    partnerName: result.partnerName,
    sourceInquiryNumberSnapshot: source.inquiryNumber,
    targetInquiryNumber: result.mirror.inquiryNumber,
  });

  if (result.removedInternalLeaderIds.length > 0) {
    void notifyInboxRefresh(result.removedInternalLeaderIds);
  }

  return {
    share: result.share,
    targetInquiryId: result.targetInquiryId,
    targetInquiryNumber: result.targetInquiryNumber,
  };
}

function parseTransferFeeInput(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw.replace(/,/g, ''), 10);
    if (Number.isNaN(n)) throw new TenantInquiryShareError('수수료는 숫자로 입력해 주세요.');
    return n;
  }
  throw new TenantInquiryShareError('수수료 형식이 올바르지 않습니다.');
}

async function applyMirrorBalanceForShare(
  tx: Prisma.TransactionClient,
  share: { targetInquiryId: string; transferFee: number | null; syncStatus: string },
  source: Pick<Inquiry, 'serviceTotalAmount' | 'serviceDepositAmount' | 'serviceBalanceAmount'>,
) {
  if (share.syncStatus !== 'ACTIVE') {
    const restored = computeSourceMirrorBalanceAmount(source);
    if (restored != null) {
      await tx.inquiry.update({
        where: { id: share.targetInquiryId },
        data: { serviceBalanceAmount: restored },
      });
    }
    return;
  }
  const adjusted = computeTargetMirrorBalanceAmount({
    serviceTotalAmount: source.serviceTotalAmount,
    serviceDepositAmount: source.serviceDepositAmount,
    serviceBalanceAmount: source.serviceBalanceAmount,
    transferFee: share.transferFee,
  });
  if (adjusted != null) {
    await tx.inquiry.update({
      where: { id: share.targetInquiryId },
      data: { serviceBalanceAmount: adjusted },
    });
  }
}

/** 송신 테넌트 — 파트너 수수료 수정 */
export async function patchTenantInquiryShareTransferFee(opts: {
  viewerTenantId: string;
  shareId: string;
  transferFee: unknown;
}) {
  const transferFee = parseTransferFeeInput(opts.transferFee);
  if (transferFee != null && transferFee < 0) {
    throw new TenantInquiryShareError('수수료는 0 이상 정수로 입력해 주세요.');
  }

  const share = await prisma.tenantInquiryShare.findFirst({
    where: { id: opts.shareId, sourceTenantId: opts.viewerTenantId },
    include: shareMetaInclude,
  });
  if (!share) {
    throw new TenantInquiryShareError('연계 정보를 찾을 수 없습니다.', 404);
  }
  if (share.syncStatus !== 'ACTIVE') {
    throw new TenantInquiryShareError('활성 연계만 수수료를 수정할 수 있습니다.');
  }

  const source = await prisma.inquiry.findFirst({
    where: { id: share.sourceInquiryId, tenantId: opts.viewerTenantId },
    select: {
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
      customerName: true,
    },
  });
  if (!source) {
    throw new TenantInquiryShareError('원본 접수를 찾을 수 없습니다.', 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenantInquiryShare.update({
      where: { id: share.id },
      data: { transferFee },
    });
    if (share.settlementMode === 'EXTERNAL_LEGACY') {
      await tx.inquiry.update({
        where: { id: share.sourceInquiryId },
        data: { externalTransferFee: transferFee },
      });
    }
    await applyMirrorBalanceForShare(tx, { ...share, transferFee }, source);
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: share.sourceInquiryId,
        customerName: source.customerName,
        actorId: null,
        lines: [
          `[파트너연계] 파트너 수수료: ${share.transferFee ?? '(없음)'} → ${transferFee ?? '(없음)'}`,
        ],
      },
    });
  });

  const updated = await prisma.tenantInquiryShare.findUniqueOrThrow({
    where: { id: share.id },
    include: shareMetaInclude,
  });
  return serializeShareMeta(updated, opts.viewerTenantId);
}

/** 송신 테넌트 — 접수 연계 취소(회수) */
export async function revokeTenantInquiryShare(opts: {
  viewerTenantId: string;
  viewerUserId: string;
  shareId: string;
}) {
  const share = await prisma.tenantInquiryShare.findFirst({
    where: { id: opts.shareId, sourceTenantId: opts.viewerTenantId },
    include: shareMetaInclude,
  });
  if (!share) {
    throw new TenantInquiryShareError('연계 정보를 찾을 수 없습니다.', 404);
  }
  if (share.syncStatus !== 'ACTIVE') {
    throw new TenantInquiryShareError('이미 취소되었거나 중지된 연계입니다.');
  }

  const marketplaceConfirmedListing = await prisma.inquiryDbListing.findFirst({
    where: {
      tenantInquiryShareId: share.id,
      status: 'CONFIRMED',
      tenantId: opts.viewerTenantId,
    },
    select: { id: true },
  });
  if (marketplaceConfirmedListing) {
    throw new TenantInquiryShareError(
      '정보공유로 인계한 건은 「접수연계 취소」 대신 접수 상세의 「완전 회수」를 사용해 주세요.',
      400,
    );
  }

  const source = await prisma.inquiry.findFirst({
    where: { id: share.sourceInquiryId, tenantId: opts.viewerTenantId },
    select: {
      customerName: true,
      inquiryNumber: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
    },
  });
  if (!source) {
    throw new TenantInquiryShareError('원본 접수를 찾을 수 없습니다.', 404);
  }

  const targetInquiry = await prisma.inquiry.findFirst({
    where: { id: share.targetInquiryId, tenantId: share.targetTenantId },
    select: { customerName: true, inquiryNumber: true },
  });

  const partnerName =
    share.partnership.tenantLow.id === opts.viewerTenantId
      ? share.partnership.tenantHigh.name
      : share.partnership.tenantLow.name;

  await prisma.$transaction(async (tx) => {
    await tx.tenantInquiryShare.update({
      where: { id: share.id },
      data: { syncStatus: 'REVOKED' },
    });
    await applyMirrorBalanceForShare(
      tx,
      { ...share, syncStatus: 'REVOKED' },
      source,
    );
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: share.sourceInquiryId,
        customerName: source.customerName,
        actorId: opts.viewerUserId,
        lines: [`[파트너연계] ${partnerName}에 대한 접수 연계를 취소했습니다.`],
      },
    });
    if (targetInquiry) {
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: share.targetInquiryId,
          customerName: targetInquiry.customerName,
          actorId: null,
          lines: [`[파트너연계] ${partnerName}에서 접수 연계가 취소되었습니다. (연계 취소됨)`],
        },
      });
    }
  });

  await notifyTenantShareRevoked({
    sourceTenantId: opts.viewerTenantId,
    sourceInquiryId: share.sourceInquiryId,
    targetTenantId: share.targetTenantId,
    targetInquiryId: share.targetInquiryId,
    customerName: source.customerName,
    partnerName,
    sourceInquiryNumber: source.inquiryNumber,
    targetInquiryNumber: targetInquiry?.inquiryNumber ?? null,
  });

  const updated = await prisma.tenantInquiryShare.findUniqueOrThrow({
    where: { id: share.id },
    include: shareMetaInclude,
  });
  return serializeShareMeta(updated, opts.viewerTenantId);
}

export async function loadShareMetaMapForInquiries(
  viewerTenantId: string,
  inquiryIds: string[],
): Promise<Map<string, SerializedTenantInquiryShareMeta>> {
  const ids = [...new Set(inquiryIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const rows = await prisma.tenantInquiryShare.findMany({
    where: {
      OR: [
        { sourceInquiryId: { in: ids }, sourceTenantId: viewerTenantId },
        { targetInquiryId: { in: ids }, targetTenantId: viewerTenantId },
      ],
    },
    include: shareMetaInclude,
  });

  const shareIds = rows.map((r) => r.id);
  const marketplaceShareIds = await loadMarketplaceConfirmedShareIdSet(shareIds);

  const map = new Map<string, SerializedTenantInquiryShareMeta>();
  const rowByInquiryId = new Map<string, ShareRow>();

  function sharePriority(status: ShareRow['syncStatus']): number {
    if (status === 'ACTIVE') return 3;
    if (status === 'PAUSED') return 2;
    return 1;
  }

  function consider(inquiryId: string, row: ShareRow, meta: SerializedTenantInquiryShareMeta) {
    const prevRow = rowByInquiryId.get(inquiryId);
    if (!prevRow) {
      rowByInquiryId.set(inquiryId, row);
      map.set(inquiryId, meta);
      return;
    }
    const better =
      sharePriority(row.syncStatus) > sharePriority(prevRow.syncStatus) ||
      (sharePriority(row.syncStatus) === sharePriority(prevRow.syncStatus) &&
        row.sharedAt > prevRow.sharedAt);
    if (better) {
      rowByInquiryId.set(inquiryId, row);
      map.set(inquiryId, meta);
    }
  }

  for (const row of rows) {
    const meta = serializeShareMeta(row, viewerTenantId, {
      viaMarketplace: marketplaceShareIds.has(row.id),
    });
    if (row.sourceInquiryId && ids.includes(row.sourceInquiryId)) {
      consider(row.sourceInquiryId, row, meta);
    }
    if (row.targetInquiryId && ids.includes(row.targetInquiryId)) {
      consider(row.targetInquiryId, row, meta);
    }
  }
  return map;
}

export async function attachTenantShareMetaToInquiry<T extends { id: string }>(
  viewerTenantId: string,
  item: T,
): Promise<T & { tenantShare: SerializedTenantInquiryShareMeta | null }> {
  const map = await loadShareMetaMapForInquiries(viewerTenantId, [item.id]);
  return { ...item, tenantShare: map.get(item.id) ?? null };
}

export async function attachTenantShareMetaToInquiries<T extends { id: string }>(
  viewerTenantId: string,
  items: T[],
): Promise<Array<T & { tenantShare: SerializedTenantInquiryShareMeta | null }>> {
  const map = await loadShareMetaMapForInquiries(
    viewerTenantId,
    items.map((i) => i.id),
  );
  return items.map((item) => ({ ...item, tenantShare: map.get(item.id) ?? null }));
}
