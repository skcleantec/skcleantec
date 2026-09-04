import type { InspectionAreaPhotoPhase } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';

export function assertCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

export async function uploadInspectionPhotoBuffer(params: {
  inquiryId: string;
  itemId: string;
  phase: InspectionAreaPhotoPhase;
  uploadedById: string;
  buffer: Buffer;
}) {
  assertCloudinaryReady();
  const result = await uploadObjectBuffer({
    folder: `cbiseo/inquiries/${params.inquiryId}/inspection/${params.itemId}/${params.phase.toLowerCase()}`,
    buffer: params.buffer,
    resourceType: 'image',
  });

  return prisma.inquiryInspectionAreaPhoto.create({
    data: {
      itemId: params.itemId,
      phase: params.phase,
      uploadedById: params.uploadedById,
      cloudinaryPublicId: result.publicId,
      secureUrl: result.secureUrl,
      width: result.width,
      height: result.height,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}

export async function uploadInspectionSignatureBuffer(params: {
  inquiryId: string;
  buffer: Buffer;
}) {
  assertCloudinaryReady();
  const result = await uploadObjectBuffer({
    folder: `cbiseo/inquiries/${params.inquiryId}/inspection/signature`,
    buffer: params.buffer,
    resourceType: 'image',
  });
  return { public_id: result.publicId, secure_url: result.secureUrl };
}

export async function deleteInspectionPhoto(params: {
  photoId: string;
  itemId: string;
  checklistId: string;
}) {
  const row = await prisma.inquiryInspectionAreaPhoto.findFirst({
    where: {
      id: params.photoId,
      itemId: params.itemId,
      item: { area: { checklistId: params.checklistId } },
    },
  });
  if (!row) return null;
  await destroyStoredObject(row.cloudinaryPublicId, 'image');
  await prisma.inquiryInspectionAreaPhoto.delete({ where: { id: row.id } });
  return row;
}

export async function patchInspectionPhotoFlag(params: {
  photoId: string;
  itemId: string;
  checklistId: string;
  flagged: boolean;
}) {
  const row = await prisma.inquiryInspectionAreaPhoto.findFirst({
    where: {
      id: params.photoId,
      itemId: params.itemId,
      item: { area: { checklistId: params.checklistId } },
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  if (!row) return null;
  if (row.phase !== 'BEFORE') {
    throw new Error('BEFORE_ONLY');
  }
  return prisma.inquiryInspectionAreaPhoto.update({
    where: { id: row.id },
    data: { flagged: params.flagged },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}
