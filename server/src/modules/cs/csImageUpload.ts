import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

export function assertCsCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
}

/** C/S 제출 사진 버퍼를 Cloudinary(skcleanteck/cs)에 업로드하고 secure_url 반환 */
export async function uploadCsImageBuffer(buffer: Buffer): Promise<{ secureUrl: string; publicId: string }> {
  assertCsCloudinaryReady();
  const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'skcleanteck/cs',
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
