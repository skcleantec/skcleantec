import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

export function assertHelpCmsCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

/** 도움말 CMS 본문 이미지 — Cloudinary cbiseo/help-cms */
export async function uploadHelpCmsImageBuffer(
  buffer: Buffer,
): Promise<{ secureUrl: string; publicId: string }> {
  assertHelpCmsCloudinaryReady();
  const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'cbiseo/help-cms',
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
