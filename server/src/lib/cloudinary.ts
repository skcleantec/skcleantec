import { v2 as cloudinary } from 'cloudinary';

/** CLOUDINARY_URL(cloudinary://KEY:SECRET@CLOUD) 또는 CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET */
function configure(): void {
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url?.startsWith('cloudinary://')) {
    const without = url.replace(/^cloudinary:\/\//, '');
    const at = without.lastIndexOf('@');
    if (at <= 0) return;
    const cloudName = without.slice(at + 1);
    const keySecret = without.slice(0, at);
    const colon = keySecret.indexOf(':');
    if (colon <= 0) return;
    const apiKey = keySecret.slice(0, colon);
    const apiSecret = keySecret.slice(colon + 1);
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return;
  }
  const cn = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const ak = process.env.CLOUDINARY_API_KEY?.trim();
  const as = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cn && ak && as) {
    cloudinary.config({ cloud_name: cn, api_key: ak, api_secret: as, secure: true });
  }
}

configure();

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloudinary.config().cloud_name);
}

export { cloudinary };
