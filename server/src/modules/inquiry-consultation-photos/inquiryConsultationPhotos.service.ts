import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

export function assertCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

export async function listConsultationPhotos(inquiryId: string) {
  return prisma.inquiryConsultationPhoto.findMany({
    where: { inquiryId },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}

export async function createConsultationPhotoRecord(params: {
  inquiryId: string;
  uploadedById: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
}) {
  return prisma.inquiryConsultationPhoto.create({
    data: {
      inquiryId: params.inquiryId,
      uploadedById: params.uploadedById,
      cloudinaryPublicId: params.cloudinaryPublicId,
      secureUrl: params.secureUrl,
      width: params.width,
      height: params.height,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}

export async function uploadConsultationImageBuffer(params: {
  inquiryId: string;
  uploadedById: string;
  buffer: Buffer;
  mimetype: string;
}) {
  assertCloudinaryReady();
  const folder = `skcleanteck/inquiries/${params.inquiryId}/consultation`;
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

  return createConsultationPhotoRecord({
    inquiryId: params.inquiryId,
    uploadedById: params.uploadedById,
    cloudinaryPublicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width ?? null,
    height: result.height ?? null,
  });
}

export async function deleteConsultationPhotoFromDbAndCloudinary(photoId: string) {
  const row = await prisma.inquiryConsultationPhoto.findUnique({ where: { id: photoId } });
  if (!row) return { deleted: false as const };
  try {
    if (isCloudinaryConfigured()) {
      await cloudinary.uploader.destroy(row.cloudinaryPublicId, { resource_type: 'image' });
    }
  } catch (e) {
    console.error('[consultation-photo] cloudinary destroy:', e);
  }
  await prisma.inquiryConsultationPhoto.delete({ where: { id: photoId } });
  return { deleted: true as const };
}

export async function assignmentTeamLeaderIdsForInquiry(inquiryId: string): Promise<string[]> {
  const rows = await prisma.assignment.findMany({
    where: { inquiryId },
    select: { teamLeaderId: true },
  });
  return [...new Set(rows.map((r) => r.teamLeaderId))];
}
