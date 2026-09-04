import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';

export async function uploadPlatformBoardImageBuffer(
  buffer: Buffer,
  boardSlug: string,
): Promise<{ secureUrl: string; publicId: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
  const safeSlug = boardSlug.replace(/[^a-z0-9-]/gi, '') || 'general';
  const result = await uploadObjectBuffer({
    folder: `cbiseo/platform-boards/${safeSlug}`,
    buffer,
    resourceType: 'image',
  });
  return { secureUrl: result.secureUrl, publicId: result.publicId };
}
