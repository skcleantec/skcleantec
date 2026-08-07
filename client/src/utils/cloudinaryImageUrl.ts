/** Cloudinary secure URL — 그리드 썸네일용 경량 transform */
export function cloudinaryThumbnailUrl(
  secureUrl: string,
  width = 240,
  height = 240,
): string {
  if (!secureUrl.includes('res.cloudinary.com') || !secureUrl.includes('/upload/')) {
    return secureUrl;
  }
  if (/\/upload\/[^/]*(?:w_|c_|q_|f_)/.test(secureUrl)) {
    return secureUrl;
  }
  return secureUrl.replace(
    '/upload/',
    `/upload/c_fill,w_${width},h_${height},q_auto,f_auto/`,
  );
}
