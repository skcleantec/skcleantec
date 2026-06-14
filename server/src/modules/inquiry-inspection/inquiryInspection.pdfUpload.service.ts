import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

export async function uploadInspectionPdfBuffer(params: {
  inquiryId: string;
  checklistId: string;
  buffer: Buffer;
}): Promise<{ publicId: string; secureUrl: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
  const folder = `skcleanteck/inquiries/${params.inquiryId}/inspection/${params.checklistId}`;
  const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        format: 'pdf',
        public_id: `completion_${Date.now()}`,
      },
      (err, res) => {
        if (err) reject(err);
        else if (!res?.public_id || !res.secure_url) reject(new Error('cloudinary_upload_failed'));
        else resolve(res as { public_id: string; secure_url: string });
      },
    );
    stream.end(params.buffer);
  });
  return { publicId: result.public_id, secureUrl: result.secure_url };
}
