import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

export async function uploadPlatformBoardImageBuffer(
  buffer: Buffer,
  boardSlug: string,
): Promise<{ secureUrl: string; publicId: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
  const safeSlug = boardSlug.replace(/[^a-z0-9-]/gi, '') || 'general';
  const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `cbiseo/platform-boards/${safeSlug}`,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'],
      },
      (err, res) => {
        if (err) reject(err);
        else if (!res?.public_id || !res.secure_url) reject(new Error('cloudinary_upload_failed'));
        else resolve(res as { public_id: string; secure_url: string });
      },
    );
    stream.end(buffer);
  });
  return { secureUrl: result.secure_url, publicId: result.public_id };
}
