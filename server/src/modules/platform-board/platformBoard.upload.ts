import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const FILE_TYPES = new Set([
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/haansofthwp',
  'application/x-hwp',
  'application/zip',
  'text/plain',
]);

export function isPlatformBoardImageType(contentType: string): boolean {
  return IMAGE_TYPES.has(contentType.toLowerCase());
}

export function assertPlatformBoardUploadType(contentType: string): void {
  const c = contentType.toLowerCase();
  if (IMAGE_TYPES.has(c) || FILE_TYPES.has(c)) return;
  throw new Error('FILE_TYPE');
}

export async function uploadPlatformBoardImageBuffer(
  buffer: Buffer,
  boardSlug: string,
  opts?: { contentType?: string; fileName?: string },
): Promise<{ secureUrl: string; publicId: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
  const contentType = opts?.contentType?.trim() || 'image/jpeg';
  assertPlatformBoardUploadType(contentType);
  const safeSlug = boardSlug.replace(/[^a-z0-9-]/gi, '') || 'general';
  const isImage = isPlatformBoardImageType(contentType);
  const result = await uploadObjectBuffer({
    folder: `cbiseo/platform-boards/${safeSlug}`,
    buffer,
    contentType,
    resourceType: isImage ? 'image' : 'raw',
    fileNameHint: opts?.fileName,
  });
  return { secureUrl: result.secureUrl, publicId: result.publicId };
}
