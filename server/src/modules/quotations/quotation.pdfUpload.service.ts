import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';

export async function uploadQuotationPdfBuffer(params: {
  tenantId: string;
  quotationId: string;
  quoteNumber: string;
  buffer: Buffer;
}): Promise<{ publicId: string; secureUrl: string } | null> {
  if (!isCloudinaryConfigured()) return null;
  const folder = `cbiseo/tenants/${params.tenantId}/quotations/${params.quotationId}`;
  const safeNo = params.quoteNumber.replace(/[^\w-]/g, '_').slice(0, 32);
  const result = await uploadObjectBuffer({
    folder,
    buffer: params.buffer,
    contentType: 'application/pdf',
    resourceType: 'raw',
    fileNameHint: `quote_${safeNo}.pdf`,
  });
  return { publicId: result.publicId, secureUrl: result.secureUrl };
}
