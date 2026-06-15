import type { InspectionAreaPhotoPhase } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

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
  const folder = `skcleanteck/inquiries/${params.inquiryId}/inspection/${params.itemId}/${params.phase.toLowerCase()}`;
  const result = await new Promise<{
    public_id: string;
    secure_url: string;
    width?: number;
    height?: number;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      },
      (err, res) => {
        if (err) reject(err);
        else if (!res?.public_id || !res.secure_url) reject(new Error('cloudinary_upload_failed'));
        else resolve(res as { public_id: string; secure_url: string; width?: number; height?: number });
      }
    );
    stream.end(params.buffer);
  });

  return prisma.inquiryInspectionAreaPhoto.create({
    data: {
      itemId: params.itemId,
      phase: params.phase,
      uploadedById: params.uploadedById,
      cloudinaryPublicId: result.public_id,
      secureUrl: result.secure_url,
      width: result.width ?? null,
      height: result.height ?? null,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}

export async function uploadInspectionSignatureBuffer(params: {
  inquiryId: string;
  buffer: Buffer;
}) {
  assertCloudinaryReady();
  const folder = `skcleanteck/inquiries/${params.inquiryId}/inspection/signature`;
  const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['png', 'jpg', 'jpeg', 'webp'],
      },
      (err, res) => {
        if (err) reject(err);
        else if (!res?.public_id || !res.secure_url) reject(new Error('cloudinary_upload_failed'));
        else resolve(res as { public_id: string; secure_url: string });
      }
    );
    stream.end(params.buffer);
  });
  return result;
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
  try {
    await cloudinary.uploader.destroy(row.cloudinaryPublicId, { resource_type: 'image' });
  } catch {
    /* ignore cloudinary delete errors */
  }
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
