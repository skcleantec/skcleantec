import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type PhotoRow = {
  cloudinaryPublicId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
};

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

/** share 생성 시 송신 접수의 기존 상담사진을 mirror로 복제(URL 공유) */
export async function copyExistingConsultationPhotosToShareMirror(
  tx: Prisma.TransactionClient,
  sourceInquiryId: string,
  targetInquiryId: string,
  targetTenantId: string,
): Promise<void> {
  const uploaderId = await resolveTargetAdminUserId(tx, targetTenantId);
  if (!uploaderId) return;
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
  const share = await prisma.tenantInquiryShare.findUnique({
    where: { sourceInquiryId },
    select: {
      targetInquiryId: true,
      targetTenantId: true,
      syncStatus: true,
      partnership: { select: { status: true } },
    },
  });
  if (!share || share.syncStatus !== 'ACTIVE' || share.partnership.status !== 'ACTIVE') return;

  const uploaderId = await resolveTargetAdminUserId(prisma, share.targetTenantId);
  if (!uploaderId) return;

  await prisma.$transaction(async (tx) => {
    await copyConsultationPhotoToMirror(tx, share.targetInquiryId, uploaderId, photo);
  });
}
