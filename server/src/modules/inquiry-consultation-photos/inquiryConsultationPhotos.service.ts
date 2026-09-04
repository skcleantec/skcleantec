import { prisma } from '../../lib/prisma.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';

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
  const result = await uploadObjectBuffer({
    folder: `cbiseo/inquiries/${params.inquiryId}/consultation`,
    buffer: params.buffer,
    contentType: params.mimetype,
    resourceType: 'image',
  });

  return createConsultationPhotoRecord({
    inquiryId: params.inquiryId,
    uploadedById: params.uploadedById,
    cloudinaryPublicId: result.publicId,
    secureUrl: result.secureUrl,
    width: result.width,
    height: result.height,
  });
}

export async function deleteConsultationPhotoFromDbAndCloudinary(photoId: string) {
  const row = await prisma.inquiryConsultationPhoto.findUnique({ where: { id: photoId } });
  if (!row) return { deleted: false as const };
  await destroyStoredObject(row.cloudinaryPublicId, 'image');
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
