import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';
import { prisma } from '../../lib/prisma.js';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function assertBusinessRegistrationImageMime(mimetype: string): void {
  if (!ALLOWED_MIMES.has(mimetype)) {
    throw new Error('business_registration_image_invalid_type');
  }
}

export async function uploadBusinessRegistrationBuffer(params: {
  folder: string;
  buffer: Buffer;
  mimetype: string;
}): Promise<{ publicId: string; secureUrl: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('cloudinary_not_configured');
  }
  const result = await uploadObjectBuffer({
    folder: params.folder,
    buffer: params.buffer,
    contentType: params.mimetype,
    resourceType: 'image',
  });
  return { publicId: result.publicId, secureUrl: result.secureUrl };
}

export async function destroyBusinessRegistrationPublicId(
  publicId: string | null | undefined,
): Promise<void> {
  await destroyStoredObject(publicId, 'image');
}

/** EXTERNAL_PARTNER 본인 업체 — 사업자등록증 이미지 교체 */
export async function replaceBusinessRegistrationForCompany(
  tenantId: string,
  externalCompanyId: string,
  buffer: Buffer,
  mimetype: string,
): Promise<{ businessRegistrationImageUrl: string }> {
  assertBusinessRegistrationImageMime(mimetype);
  const company = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, tenantId },
    select: { businessRegistrationImagePublicId: true },
  });
  if (!company) {
    throw new Error('external_company_not_found');
  }
  const folder = `cbiseo/business-registration/${tenantId}/${externalCompanyId}`;
  const uploaded = await uploadBusinessRegistrationBuffer({ folder, buffer, mimetype });
  const oldPid = company.businessRegistrationImagePublicId;
  await prisma.externalCompany.update({
    where: { id: externalCompanyId },
    data: {
      businessRegistrationImagePublicId: uploaded.publicId,
      businessRegistrationImageUrl: uploaded.secureUrl,
    },
  });
  await destroyBusinessRegistrationPublicId(oldPid);
  return { businessRegistrationImageUrl: uploaded.secureUrl };
}
