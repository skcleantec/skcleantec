import type { Inquiry, Prisma, TenantInquiryShareDirection } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { allocateNextInquiryNumber } from '../inquiries/inquiryNumber.js';
import { getDefaultOperatingCompanyId } from '../operating-companies/operatingCompany.service.js';

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

export function serializeShareMeta(row: ShareRow, viewerTenantId: string): SerializedTenantInquiryShareMeta {
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
    source: '테넌트DB',
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

export async function createTenantInquiryShare(opts: {
  viewerTenantId: string;
  viewerUserId: string;
  inquiryId: string;
  partnershipId: string;
  transferFee?: number | null;
}) {
  const { viewerTenantId, viewerUserId, inquiryId, partnershipId } = opts;
  const transferFee =
    opts.transferFee === undefined || opts.transferFee === null ? null : Math.trunc(opts.transferFee);
  if (transferFee != null && (transferFee < 0 || !Number.isFinite(transferFee))) {
    throw new TenantInquiryShareError('수수료는 0 이상 정수로 입력해 주세요.');
  }

  const partnership = await prisma.tenantPartnership.findFirst({
    where: {
      id: partnershipId,
      OR: [{ tenantLowId: viewerTenantId }, { tenantHighId: viewerTenantId }],
    },
  });
  if (!partnership) {
    throw new TenantInquiryShareError('파트너십을 찾을 수 없습니다.', 404);
  }
  if (partnership.status !== 'ACTIVE') {
    throw new TenantInquiryShareError('ACTIVE 상태의 파트너에게만 DB를 전달할 수 있습니다.');
  }

  const source = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId: viewerTenantId },
  });
  if (!source) {
    throw new TenantInquiryShareError('접수를 찾을 수 없습니다.', 404);
  }

  const existingAsSource = await prisma.tenantInquiryShare.findUnique({
    where: { sourceInquiryId: inquiryId },
  });
  if (existingAsSource) {
    throw new TenantInquiryShareError('이미 다른 파트너에게 전달된 접수입니다.');
  }

  const existingAsTarget = await prisma.tenantInquiryShare.findUnique({
    where: { targetInquiryId: inquiryId },
  });
  if (existingAsTarget) {
    throw new TenantInquiryShareError('수신된 접수는 다시 전달할 수 없습니다.');
  }

  const targetTenantId =
    viewerTenantId === partnership.tenantLowId ? partnership.tenantHighId : partnership.tenantLowId;
  const direction = resolveShareDirection(partnership, viewerTenantId);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const targetOcId = await getDefaultOperatingCompanyId(tx, targetTenantId);
    const targetInquiryNumber = await allocateNextInquiryNumber(tx, targetTenantId, targetOcId);

    const mirror = await tx.inquiry.create({
      data: buildMirrorInquiryUnchecked(source, targetTenantId, targetOcId, targetInquiryNumber),
    });

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
      },
      include: shareMetaInclude,
    });

    return { share, mirror };
  });

  return {
    share: serializeShareMeta(result.share, viewerTenantId),
    targetInquiryId: result.mirror.id,
    targetInquiryNumber: result.mirror.inquiryNumber,
  };
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

  const map = new Map<string, SerializedTenantInquiryShareMeta>();
  for (const row of rows) {
    const meta = serializeShareMeta(row, viewerTenantId);
    if (row.sourceInquiryId && ids.includes(row.sourceInquiryId)) {
      map.set(row.sourceInquiryId, meta);
    }
    if (row.targetInquiryId && ids.includes(row.targetInquiryId)) {
      map.set(row.targetInquiryId, meta);
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
