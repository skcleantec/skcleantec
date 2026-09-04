import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';

export function assertHelpInquiryCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

/** 고객문의 게시판 첨부 */
export async function uploadHelpInquiryImageBuffer(
  buffer: Buffer,
): Promise<{ secureUrl: string; publicId: string }> {
  assertHelpInquiryCloudinaryReady();
  const result = await uploadObjectBuffer({
    folder: 'cbiseo/help-inquiry',
    buffer,
    resourceType: 'image',
  });
  return { secureUrl: result.secureUrl, publicId: result.publicId };
}
