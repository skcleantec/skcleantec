import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';

export function assertCsCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

/** C/S 제출 사진 */
export async function uploadCsImageBuffer(buffer: Buffer): Promise<{ secureUrl: string; publicId: string }> {
  assertCsCloudinaryReady();
  const result = await uploadObjectBuffer({
    folder: 'cbiseo/cs',
    buffer,
    resourceType: 'image',
  });
  return { secureUrl: result.secureUrl, publicId: result.publicId };
}
