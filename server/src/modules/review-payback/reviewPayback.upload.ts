import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

export function assertReviewPaybackCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

/** 리뷰 캡처 이미지 — Cloudinary skcleanteck/review-payback */
export async function uploadReviewPaybackImageBuffer(
  buffer: Buffer,
  tenantId: string,
): Promise<{ secureUrl: string; publicId: string }> {
  assertReviewPaybackCloudinaryReady();
  const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `skcleanteck/review-payback/${tenantId}`,
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
