import type { CleaningPhotoPhase } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';

export function assertCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

export async function listPhotos(inquiryId: string) {
  return prisma.inquiryCleaningPhoto.findMany({
    where: { inquiryId },
    orderBy: [{ phase: 'asc' }, { createdAt: 'desc' }],
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}

export async function createPhotoRecord(params: {
  inquiryId: string;
  phase: CleaningPhotoPhase;
  uploadedById: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
}) {
  return prisma.inquiryCleaningPhoto.create({
    data: {
      inquiryId: params.inquiryId,
      phase: params.phase,
      uploadedById: params.uploadedById,
      cloudinaryPublicId: params.cloudinaryPublicId,
      secureUrl: params.secureUrl,
      width: params.width,
      height: params.height,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}

export async function uploadImageBuffer(params: {
  inquiryId: string;
  phase: CleaningPhotoPhase;
  uploadedById: string;
  buffer: Buffer;
  mimetype: string;
}) {
  assertCloudinaryReady();
  const result = await uploadObjectBuffer({
    folder: `cbiseo/inquiries/${params.inquiryId}/${params.phase.toLowerCase()}`,
    buffer: params.buffer,
    contentType: params.mimetype,
    resourceType: 'image',
  });

  return createPhotoRecord({
    inquiryId: params.inquiryId,
    phase: params.phase,
    uploadedById: params.uploadedById,
    cloudinaryPublicId: result.publicId,
    secureUrl: result.secureUrl,
    width: result.width,
    height: result.height,
  });
}

export async function deletePhotoFromDbAndCloudinary(photoId: string) {
  const row = await prisma.inquiryCleaningPhoto.findUnique({ where: { id: photoId } });
  if (!row) return { deleted: false as const };
  await destroyStoredObject(row.cloudinaryPublicId, 'image');
  await prisma.inquiryCleaningPhoto.delete({ where: { id: photoId } });
  return { deleted: true as const };
}
