import type { Inquiry, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  filterKeysByShareMask,
  normalizeShareFieldMask,
} from './tenantInquiryShareFields.js';
import {
  BIDIRECTIONAL_SHARE_STATUSES,
  SYNC_WHITELIST_KEYS,
  type TenantShareSyncWhitelistKey,
} from './tenantInquirySync.service.js';

export type ShareMirrorSyncRow = {
  sourceInquiryId: string;
  targetInquiryId: string;
  syncFieldMask: unknown;
  settlementMode: 'PARTNER_NATIVE' | 'EXTERNAL_LEGACY';
  transferFee: number | null;
};

function pickMirrorPayloadFromSource(
  source: Inquiry,
  opts: { ignoreFieldMask: boolean; syncFieldMask: unknown },
): Prisma.InquiryUncheckedUpdateInput {
  const fieldMask = opts.ignoreFieldMask ? null : normalizeShareFieldMask(opts.syncFieldMask);
  const keys = opts.ignoreFieldMask
    ? [...SYNC_WHITELIST_KEYS]
    : filterKeysByShareMask([...SYNC_WHITELIST_KEYS], fieldMask);

  const payload: Prisma.InquiryUncheckedUpdateInput = {};
  for (const key of keys) {
    (payload as Record<string, unknown>)[key] = source[key as TenantShareSyncWhitelistKey];
  }
  if (BIDIRECTIONAL_SHARE_STATUSES.includes(source.status)) {
    payload.status = source.status;
  }
  return payload;
}

/** 타업체→파트너 이관(EXTERNAL_LEGACY) 후 mirror가 송신 접수와 동일하게 맞춰지도록 전 필드 반영 */
export async function fullSyncShareMirrorFromSourceInTransaction(
  tx: Prisma.TransactionClient,
  share: ShareMirrorSyncRow,
  opts?: { ignoreFieldMask?: boolean },
): Promise<{ updated: boolean }> {
  const source = await tx.inquiry.findUnique({ where: { id: share.sourceInquiryId } });
  if (!source) return { updated: false };

  const ignoreFieldMask =
    opts?.ignoreFieldMask === true || share.settlementMode === 'EXTERNAL_LEGACY';

  const payload = pickMirrorPayloadFromSource(source, {
    ignoreFieldMask,
    syncFieldMask: share.syncFieldMask,
  });

  if (Object.keys(payload).length === 0) return { updated: false };

  await tx.inquiry.update({
    where: { id: share.targetInquiryId },
    data: payload,
  });

  return { updated: true };
}

/** 발주서에만 있는 값으로 송신 접수 빈 칸 보강(이관 직전) */
export async function backfillSourceInquiryFromOrderFormForMigration(
  tx: Prisma.TransactionClient,
  source: Inquiry,
): Promise<Inquiry> {
  if (!source.orderFormId) return source;

  const form = await tx.orderForm.findFirst({
    where: { id: source.orderFormId, tenantId: source.tenantId },
    select: {
      customerPhone: true,
      preferredDate: true,
      preferredTime: true,
      preferredTimeDetail: true,
      areaPyeong: true,
      areaBasis: true,
    },
  });
  if (!form) return source;

  const data: Prisma.InquiryUpdateInput = {};
  if (!String(source.customerPhone ?? '').trim() && String(form.customerPhone ?? '').trim()) {
    data.customerPhone = String(form.customerPhone).trim();
  }
  if (!source.preferredDate && form.preferredDate?.trim()) {
    const d = new Date(`${form.preferredDate.trim()}T12:00:00`);
    if (!Number.isNaN(d.getTime())) data.preferredDate = d;
  }
  if (!source.preferredTime?.trim() && form.preferredTime?.trim()) {
    data.preferredTime = form.preferredTime.trim();
  }
  if (!source.preferredTimeDetail?.trim() && form.preferredTimeDetail?.trim()) {
    data.preferredTimeDetail = form.preferredTimeDetail.trim();
  }
  if (source.areaPyeong == null && form.areaPyeong != null) {
    data.areaPyeong = form.areaPyeong;
  }
  if (!source.areaBasis?.trim() && form.areaBasis?.trim()) {
    data.areaBasis = form.areaBasis.trim();
  }

  if (Object.keys(data).length === 0) return source;

  return tx.inquiry.update({
    where: { id: source.id },
    data,
  });
}

export async function resyncExternalLegacyMigratedMirrors(opts: {
  tenantId: string;
  externalCompanyId: string;
}): Promise<{ total: number; updated: number }> {
  const shares = await prisma.tenantInquiryShare.findMany({
    where: {
      sourceTenantId: opts.tenantId,
      syncStatus: 'ACTIVE',
      settlementMode: 'EXTERNAL_LEGACY',
      settlementExternalCompanyId: opts.externalCompanyId,
    },
    select: {
      sourceInquiryId: true,
      targetInquiryId: true,
      syncFieldMask: true,
      settlementMode: true,
      transferFee: true,
    },
  });

  let updated = 0;
  for (const share of shares) {
    const row = await prisma.$transaction((tx) =>
      fullSyncShareMirrorFromSourceInTransaction(tx, share, { ignoreFieldMask: true }),
    );
    if (row.updated) updated += 1;
  }

  return { total: shares.length, updated };
}
