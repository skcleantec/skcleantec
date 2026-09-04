/** @see shared/storedObjectUrl.ts */
export const R2_PUBLIC_ID_PREFIX = 'r2:';

export function isHttpsHostedImageUrl(urlRaw: string): boolean {
  const u = urlRaw.trim().toLowerCase();
  if (!u.startsWith('https://')) return false;
  return (
    u.includes('res.cloudinary.com') ||
    u.includes('/image/upload/v') ||
    u.includes('.r2.dev') ||
    u.includes('.r2.cloudflarestorage.com')
  );
}

export function storedPublicIdHasFolder(publicIdRaw: string, folderPrefix: string): boolean {
  const pid = publicIdRaw.trim();
  const folder = folderPrefix.replace(/^\/+|\/+$/g, '');
  if (!pid || !folder) return false;
  if (pid.startsWith(R2_PUBLIC_ID_PREFIX)) {
    return pid.includes(`${folder}/`) || pid.endsWith(`/${folder}`);
  }
  return pid.startsWith(`${folder}/`) || pid === folder;
}

export function isLikelyStoredContractImage(urlRaw: unknown, publicIdRaw: unknown, folderPrefix: string): boolean {
  if (typeof urlRaw !== 'string' || typeof publicIdRaw !== 'string') return false;
  const url = urlRaw.trim();
  const pid = publicIdRaw.trim();
  if (!url || !pid) return false;
  return isHttpsHostedImageUrl(url) && storedPublicIdHasFolder(pid, folderPrefix);
}
