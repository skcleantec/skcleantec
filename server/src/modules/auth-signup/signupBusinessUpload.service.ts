import { randomUUID } from 'node:crypto';
import {
  assertBusinessRegistrationImageMime,
  uploadBusinessRegistrationBuffer,
} from '../onboarding/businessRegistration.service.js';

export async function uploadSignupBusinessRegistrationImage(
  buffer: Buffer,
  mimetype: string,
): Promise<{ businessRegistrationImageUrl: string; businessRegistrationImagePublicId: string }> {
  assertBusinessRegistrationImageMime(mimetype);
  const folder = `cbiseo/signup-business-registration/${randomUUID()}`;
  const uploaded = await uploadBusinessRegistrationBuffer({ folder, buffer, mimetype });
  return {
    businessRegistrationImageUrl: uploaded.secureUrl,
    businessRegistrationImagePublicId: uploaded.publicId,
  };
}
