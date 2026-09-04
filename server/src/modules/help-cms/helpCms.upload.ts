import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';

export function assertHelpCmsCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

/** 도움말 CMS 본문 이미지 */
export async function uploadHelpCmsImageBuffer(
  buffer: Buffer,
): Promise<{ secureUrl: string; publicId: string }> {
  assertHelpCmsCloudinaryReady();
  const result = await uploadObjectBuffer({
    folder: 'cbiseo/help-cms',
    buffer,
    resourceType: 'image',
  });
  return { secureUrl: result.secureUrl, publicId: result.publicId };
}
