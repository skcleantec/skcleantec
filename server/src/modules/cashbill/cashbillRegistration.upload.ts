import {
  assertBusinessRegistrationImageMime,
  uploadBusinessRegistrationBuffer,
} from '../onboarding/businessRegistration.service.js';
import { cashbillRegistrationFolder } from '../../lib/barobill/bizNumber.js';

export async function uploadCashbillRegistrationImage(params: {
  tenantId: string;
  operatingCompanyId: string;
  buffer: Buffer;
  mimetype: string;
}): Promise<{ businessRegistrationImageUrl: string; businessRegistrationImagePublicId: string }> {
  assertBusinessRegistrationImageMime(params.mimetype);
  const uploaded = await uploadBusinessRegistrationBuffer({
    folder: cashbillRegistrationFolder(params.tenantId, params.operatingCompanyId),
    buffer: params.buffer,
    mimetype: params.mimetype,
  });
  return {
    businessRegistrationImageUrl: uploaded.secureUrl,
    businessRegistrationImagePublicId: uploaded.publicId,
  };
}
