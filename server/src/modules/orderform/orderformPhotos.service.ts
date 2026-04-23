import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

export function assertCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

export type OrderFormPhotoRow = {
  id: string;
  orderFormId: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
};

export function serializeOrderFormPhoto(row: OrderFormPhotoRow) {
  return {
    id: row.id,
    orderFormId: row.orderFormId,
    secureUrl: row.secureUrl,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listOrderFormPhotos(orderFormId: string) {
  return prisma.orderFormPhoto.findMany({
    where: { orderFormId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function uploadOrderFormPhotoBuffer(params: {
  orderFormId: string;
  buffer: Buffer;
  mimetype: string;
}) {
  assertCloudinaryReady();
  const folder = `skcleanteck/orderforms/${params.orderFormId}`;
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
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'],
      },
      (err, res) => {
        if (err) reject(err);
        else if (!res?.public_id || !res.secure_url) reject(new Error('cloudinary_upload_failed'));
        else resolve(res as { public_id: string; secure_url: string; width?: number; height?: number });
      }
    );
    stream.end(params.buffer);
  });

  return prisma.orderFormPhoto.create({
    data: {
      orderFormId: params.orderFormId,
      cloudinaryPublicId: result.public_id,
      secureUrl: result.secure_url,
      width: result.width ?? null,
      height: result.height ?? null,
    },
  });
}

export async function deleteOrderFormPhoto(photoId: string) {
  const row = await prisma.orderFormPhoto.findUnique({ where: { id: photoId } });
  if (!row) return { deleted: false as const };
  try {
    if (isCloudinaryConfigured()) {
      await cloudinary.uploader.destroy(row.cloudinaryPublicId, { resource_type: 'image' });
    }
  } catch (e) {
    console.error('[order-form-photo] cloudinary destroy:', e);
  }
  await prisma.orderFormPhoto.delete({ where: { id: photoId } });
  return { deleted: true as const };
}
