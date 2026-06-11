import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { normalizeShareFieldMask } from './tenantInquiryShareFields.js';

type PhotoRow = {
  cloudinaryPublicId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
};

type ActiveShareRow = {
  targetInquiryId: string;
  targetTenantId: string;
  syncFieldMask: unknown;
};

/** 부분 전달(field mask) 시 상담사진 cross-tenant 미동기화 — 전체 전달만 사진 복제 */
export function shouldSyncConsultationPhotosForShare(syncFieldMask: unknown): boolean {
  return normalizeShareFieldMask(syncFieldMask) === null;
}

async function resolveTargetAdminUserId(
  tx: Prisma.TransactionClient,
  targetTenantId: string,
): Promise<string | null> {
  const admin = await tx.user.findFirst({
    where: { tenantId: targetTenantId, role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return admin?.id ?? null;
}

async function copyConsultationPhotoToMirror(
  tx: Prisma.TransactionClient,
  targetInquiryId: string,
  uploadedById: string,
  photo: PhotoRow,
): Promise<void> {
  const dup = await tx.inquiryConsultationPhoto.findFirst({
    where: { inquiryId: targetInquiryId, cloudinaryPublicId: photo.cloudinaryPublicId },
    select: { id: true },
  });
  if (dup) return;
  await tx.inquiryConsultationPhoto.create({
    data: {
      inquiryId: targetInquiryId,
      uploadedById,
      cloudinaryPublicId: photo.cloudinaryPublicId,
      secureUrl: photo.secureUrl,
      width: photo.width,
      height: photo.height,
    },
  });
}

async function loadActiveShareAsSource(sourceInquiryId: string): Promise<ActiveShareRow | null> {
  const share = await prisma.tenantInquiryShare.findUnique({
    where: { sourceInquiryId },
    select: {
      targetInquiryId: true,
      targetTenantId: true,
      syncStatus: true,
      syncFieldMask: true,
      partnership: { select: { status: true } },
    },
  });
  if (!share || share.syncStatus !== 'ACTIVE' || share.partnership.status !== 'ACTIVE') return null;
  if (!shouldSyncConsultationPhotosForShare(share.syncFieldMask)) return null;
  return share;
}

async function withMirrorSyncRetry(fn: () => Promise<void>, label: string): Promise<void> {
  const delays = [0, 400];
  let last: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      await fn();
      return;
    } catch (e) {
      last = e;
      console.error(`[tenant-share-photo] ${label} attempt ${i + 1} failed`, e);
    }
  }
  throw last;
}

/** share 생성 시 송신 접수의 기존 상담사진을 mirror로 복제(URL 공유) — 전체 전달만 */
export async function copyExistingConsultationPhotosToShareMirror(
  tx: Prisma.TransactionClient,
  sourceInquiryId: string,
  targetInquiryId: string,
  targetTenantId: string,
  syncFieldMask: unknown,
): Promise<void> {
  if (!shouldSyncConsultationPhotosForShare(syncFieldMask)) return;

  const uploaderId = await resolveTargetAdminUserId(tx, targetTenantId);
  if (!uploaderId) {
    console.warn('[tenant-share-photo] copy skipped: no active ADMIN on target tenant', targetTenantId);
    return;
  }
  const photos = await tx.inquiryConsultationPhoto.findMany({
    where: { inquiryId: sourceInquiryId },
    select: {
      cloudinaryPublicId: true,
      secureUrl: true,
      width: true,
      height: true,
    },
  });
  for (const photo of photos) {
    await copyConsultationPhotoToMirror(tx, targetInquiryId, uploaderId, photo);
  }
}

/** 송신 접수에 상담사진 업로드 시 ACTIVE share mirror에 복제 */
export async function syncConsultationPhotoUploadToShareMirror(
  sourceInquiryId: string,
  photo: PhotoRow,
): Promise<void> {
  await withMirrorSyncRetry(async () => {
    const share = await loadActiveShareAsSource(sourceInquiryId);
    if (!share) return;

    const uploaderId = await resolveTargetAdminUserId(prisma, share.targetTenantId);
    if (!uploaderId) {
      console.warn('[tenant-share-photo] upload sync skipped: no active ADMIN on target tenant');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await copyConsultationPhotoToMirror(tx, share.targetInquiryId, uploaderId, photo);
    });
  }, 'upload');
}

/** 송신 접수 상담사진 삭제 시 mirror DB 행만 제거(Cloudinary는 송신 삭제 흐름에서 처리) */
export async function syncConsultationPhotoDeleteFromShareMirror(
  sourceInquiryId: string,
  cloudinaryPublicId: string,
): Promise<void> {
  await withMirrorSyncRetry(async () => {
    const share = await loadActiveShareAsSource(sourceInquiryId);
    if (!share) return;

    await prisma.inquiryConsultationPhoto.deleteMany({
      where: {
        inquiryId: share.targetInquiryId,
        cloudinaryPublicId,
      },
    });
  }, 'delete');
}
