import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';

export async function uploadInspectionPdfBuffer(params: {
  inquiryId: string;
  checklistId: string;
  buffer: Buffer;
}): Promise<{ publicId: string; secureUrl: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
  const folder = `cbiseo/inquiries/${params.inquiryId}/inspection/${params.checklistId}`;
  const result = await uploadObjectBuffer({
    folder,
    buffer: params.buffer,
    contentType: 'application/pdf',
    resourceType: 'raw',
    fileNameHint: 'completion.pdf',
  });
  return { publicId: result.publicId, secureUrl: result.secureUrl };
}
