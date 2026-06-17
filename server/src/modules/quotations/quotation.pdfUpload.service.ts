import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';

export async function uploadQuotationPdfBuffer(params: {
  tenantId: string;
  quotationId: string;
  quoteNumber: string;
  buffer: Buffer;
}): Promise<{ publicId: string; secureUrl: string } | null> {
  if (!isCloudinaryConfigured()) return null;
  const folder = `skcleanteck/tenants/${params.tenantId}/quotations/${params.quotationId}`;
  const safeNo = params.quoteNumber.replace(/[^\w-]/g, '_').slice(0, 32);
  const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        format: 'pdf',
        public_id: `quote_${safeNo}_${Date.now()}`,
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
