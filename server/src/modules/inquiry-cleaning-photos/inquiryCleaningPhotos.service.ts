import type { CleaningPhotoPhase } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

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
  const folder = `skcleanteck/inquiries/${params.inquiryId}/${params.phase.toLowerCase()}`;
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

  return createPhotoRecord({
    inquiryId: params.inquiryId,
    phase: params.phase,
    uploadedById: params.uploadedById,
    cloudinaryPublicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width ?? null,
    height: result.height ?? null,
  });
}

export async function deletePhotoFromDbAndCloudinary(photoId: string) {
  const row = await prisma.inquiryCleaningPhoto.findUnique({ where: { id: photoId } });
  if (!row) return { deleted: false as const };
  try {
    if (isCloudinaryConfigured()) {
      await cloudinary.uploader.destroy(row.cloudinaryPublicId, { resource_type: 'image' });
    }
  } catch (e) {
    console.error('[cleaning-photo] cloudinary destroy:', e);
  }
  await prisma.inquiryCleaningPhoto.delete({ where: { id: photoId } });
  return { deleted: true as const };
}
