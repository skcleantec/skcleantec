import { prisma } from '../../lib/prisma.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';

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
  const result = await uploadObjectBuffer({
    folder: `cbiseo/orderforms/${params.orderFormId}`,
    buffer: params.buffer,
    contentType: params.mimetype,
    resourceType: 'image',
  });

  return prisma.orderFormPhoto.create({
    data: {
      orderFormId: params.orderFormId,
      cloudinaryPublicId: result.publicId,
      secureUrl: result.secureUrl,
      width: result.width,
      height: result.height,
    },
  });
}

export async function deleteOrderFormPhoto(photoId: string) {
  const row = await prisma.orderFormPhoto.findUnique({ where: { id: photoId } });
  if (!row) return { deleted: false as const };
  await destroyStoredObject(row.cloudinaryPublicId, 'image');
  await prisma.orderFormPhoto.delete({ where: { id: photoId } });
  return { deleted: true as const };
}
