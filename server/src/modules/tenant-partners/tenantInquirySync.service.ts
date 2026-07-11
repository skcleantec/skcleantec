import type { Inquiry, InquiryStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { stampTenantShareCancelFeeDirection } from './tenantPartnerSettlement.service.js';
import { computeTargetMirrorBalanceAmount } from './tenantInquiryShareBalance.helpers.js';
import { filterKeysByShareMask, normalizeShareFieldMask } from './tenantInquiryShareFields.js';

export const TENANT_SHARE_SYNC_LOG_PREFIX = '[파트너연계동기화]';

const SYNC_WHITELIST_KEYS = [
  'customerName',
  'nickname',
  'customerPhone',
  'customerPhone2',
  'address',
  'addressDetail',
  'addressGeoQuery',
  'addressGeoLat',
  'addressGeoLng',
  'propertyType',
  'areaPyeong',
  'areaBasis',
  'exclusiveAreaSqm',
  'isOneRoom',
  'roomCount',
  'bathroomCount',
  'balconyCount',
  'kitchenCount',
  'preferredDate',
  'preferredTime',
  'preferredTimeDetail',
  'betweenScheduleSlot',
  'buildingType',
  'moveInDate',
  'moveInDateUndecided',
  'serviceTotalAmount',
  'serviceDepositAmount',
  'serviceBalanceAmount',
  'specialNotes',
  'consultationMemo',
  'memo',
] as const satisfies ReadonlyArray<keyof Inquiry>;

const BIDIRECTIONAL_STATUSES: InquiryStatus[] = ['COMPLETED', 'CANCELLED'];

type WhitelistKey = (typeof SYNC_WHITELIST_KEYS)[number];

const FIELD_LABELS: Partial<Record<WhitelistKey | 'status', string>> = {
  customerName: '고객명',
  nickname: '호칭',
  customerPhone: '연락처',
  customerPhone2: '연락처2',
  address: '주소',
  addressDetail: '상세주소',
  propertyType: '유형',
  areaPyeong: '평수',
  areaBasis: '면적기준',
  exclusiveAreaSqm: '전용㎡',
  isOneRoom: '원룸',
  roomCount: '방',
  bathroomCount: '욕실',
  balconyCount: '발코니',
  kitchenCount: '주방',
  preferredDate: '예약일',
  preferredTime: '희망시간',
  preferredTimeDetail: '시간상세',
  betweenScheduleSlot: '사이청소슬롯',
  buildingType: '건물유형',
  moveInDate: '이사일',
  moveInDateUndecided: '이사일미정',
  serviceTotalAmount: '총액',
  serviceDepositAmount: '예약금',
  serviceBalanceAmount: '잔금',
  specialNotes: '특이사항',
  consultationMemo: '상담메모',
  memo: '메모',
  status: '상태',
};

function fmtVal(key: WhitelistKey | 'status', v: unknown): string {
  if (v == null || v === '') return '(비움)';
  if (key === 'preferredDate' && v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  if (key === 'moveInDate' && v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  return String(v);
}

function buildSyncLines(
  before: Inquiry,
  after: Inquiry,
  keys: Array<WhitelistKey | 'status'>,
): string[] {
  const lines: string[] = [];
  for (const key of keys) {
    const b = before[key as keyof Inquiry];
    const a = after[key as keyof Inquiry];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    const label = FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${fmtVal(key, b)} → ${fmtVal(key, a)}`);
  }
  return lines;
}

type ShareSyncRow = {
  id: string;
  sourceTenantId: string;
  sourceInquiryId: string;
  targetTenantId: string;
  targetInquiryId: string;
  transferFee: number | null;
  syncStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  syncFieldMask: unknown;
  partnership: { status: string };
};

async function loadShareForInquiry(inquiryId: string): Promise<ShareSyncRow | null> {
  const asSource = await prisma.tenantInquiryShare.findUnique({
    where: { sourceInquiryId: inquiryId },
    select: {
      id: true,
      sourceTenantId: true,
      sourceInquiryId: true,
      targetTenantId: true,
      targetInquiryId: true,
      transferFee: true,
      syncStatus: true,
      syncFieldMask: true,
      partnership: { select: { status: true } },
    },
  });
  if (asSource) return asSource;
  const asTarget = await prisma.tenantInquiryShare.findUnique({
    where: { targetInquiryId: inquiryId },
    select: {
      id: true,
      sourceTenantId: true,
      sourceInquiryId: true,
      targetTenantId: true,
      targetInquiryId: true,
      transferFee: true,
      syncStatus: true,
      syncFieldMask: true,
      partnership: { select: { status: true } },
    },
  });
  return asTarget;
}

function isSyncAllowed(share: ShareSyncRow): boolean {
  return share.syncStatus === 'ACTIVE' && share.partnership.status === 'ACTIVE';
}

function pickSyncPayload(
  inquiryAfter: Inquiry,
  changedKeys: string[],
  opts: { syncWhitelist: boolean; syncStatus: boolean },
): Prisma.InquiryUncheckedUpdateInput {
  const payload: Prisma.InquiryUncheckedUpdateInput = {};
  if (opts.syncWhitelist) {
    for (const key of SYNC_WHITELIST_KEYS) {
      if (changedKeys.includes(key)) {
        (payload as Record<string, unknown>)[key] = inquiryAfter[key];
      }
    }
  }
  if (opts.syncStatus && changedKeys.includes('status')) {
    const st = inquiryAfter.status;
    if (BIDIRECTIONAL_STATUSES.includes(st)) {
      payload.status = st;
    }
  }
  return payload;
}

/**
 * 접수 PATCH 후 테넌트 share mirror 동기화 (cross-tenant write는 이 함수만).
 * - 송신(source): 화이트리스트 + COMPLETED/CANCELLED → 수신(target)
 * - 수신(target): COMPLETED/CANCELLED 만 → 송신(source)
 */
export async function syncTenantShareAfterInquiryPatch(opts: {
  inquiryId: string;
  viewerTenantId: string;
  actorId?: string | null;
  changedKeys: string[];
  inquiryAfter: Inquiry;
}): Promise<void> {
  const { inquiryId, viewerTenantId, changedKeys, inquiryAfter } = opts;
  if (changedKeys.length === 0) return;

  const share = await loadShareForInquiry(inquiryId);
  if (!share || !isSyncAllowed(share)) return;

  const isSource = share.sourceInquiryId === inquiryId && share.sourceTenantId === viewerTenantId;
  const isTarget = share.targetInquiryId === inquiryId && share.targetTenantId === viewerTenantId;
  if (!isSource && !isTarget) return;

  const peerId = isSource ? share.targetInquiryId : share.sourceInquiryId;
  const statusChanged = changedKeys.includes('status');
  const fieldMask = normalizeShareFieldMask(share.syncFieldMask);
  const effectiveChangedKeys = isSource ? filterKeysByShareMask(changedKeys, fieldMask) : changedKeys;
  const syncWhitelist = isSource && effectiveChangedKeys.some((k) => SYNC_WHITELIST_KEYS.includes(k as WhitelistKey));
  const syncStatus =
    statusChanged && (isSource || isTarget) && effectiveChangedKeys.includes('status');

  if (!syncWhitelist && !syncStatus) return;

  const payload = pickSyncPayload(inquiryAfter, effectiveChangedKeys, { syncWhitelist, syncStatus });
  if (Object.keys(payload).length === 0) return;

  const amountKeys = ['serviceTotalAmount', 'serviceDepositAmount', 'serviceBalanceAmount'] as const;
  const amountTouched = isSource && amountKeys.some((k) => k in payload);
  if (amountTouched && isSource) {
    const adjusted = computeTargetMirrorBalanceAmount({
      serviceTotalAmount:
        (payload.serviceTotalAmount as number | null | undefined) ?? inquiryAfter.serviceTotalAmount,
      serviceDepositAmount:
        (payload.serviceDepositAmount as number | null | undefined) ?? inquiryAfter.serviceDepositAmount,
      serviceBalanceAmount:
        (payload.serviceBalanceAmount as number | null | undefined) ?? inquiryAfter.serviceBalanceAmount,
      transferFee: share.transferFee,
    });
    if (adjusted != null) {
      payload.serviceBalanceAmount = adjusted;
    }
  }

  await prisma.$transaction(async (tx) => {
    const peerBefore = await tx.inquiry.findUnique({ where: { id: peerId } });
    if (!peerBefore) return;

    const peerAfter = { ...peerBefore, ...payload } as Inquiry;
    const logKeys = Object.keys(payload).filter(
      (k): k is WhitelistKey | 'status' => k === 'status' || SYNC_WHITELIST_KEYS.includes(k as WhitelistKey),
    );
    const lines = buildSyncLines(peerBefore, peerAfter, logKeys);
    if (lines.length === 0) return;

    await tx.inquiry.update({
      where: { id: peerId },
      data: payload,
    });

    if (payload.status === 'CANCELLED') {
      await stampTenantShareCancelFeeDirection(tx, peerId);
      if (inquiryAfter.status === 'CANCELLED') {
        await stampTenantShareCancelFeeDirection(tx, inquiryId);
      }
    }

    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: peerId,
        customerName: peerBefore.customerName,
        actorId: opts.actorId ?? null,
        lines: lines.map((line) => `${TENANT_SHARE_SYNC_LOG_PREFIX} ${line}`),
      },
    });
  });
}
