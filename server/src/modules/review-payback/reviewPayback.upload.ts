import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';

export function assertReviewPaybackCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

/** 리뷰 캡처 이미지 */
export async function uploadReviewPaybackImageBuffer(
  buffer: Buffer,
  tenantId: string,
): Promise<{ secureUrl: string; publicId: string }> {
  assertReviewPaybackCloudinaryReady();
  const result = await uploadObjectBuffer({
    folder: `cbiseo/review-payback/${tenantId}`,
    buffer,
    resourceType: 'image',
  });
  return { secureUrl: result.secureUrl, publicId: result.publicId };
}
