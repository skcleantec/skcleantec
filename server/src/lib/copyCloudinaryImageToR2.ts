import { cloudinary, isCloudinaryAccountConfigured } from './cloudinary.js';
import { uploadObjectBuffer } from './objectStorage.js';

function isCloudinaryHostedUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('res.cloudinary.com') || u.includes('cloudinary.com');
}

/** `/cloud/image/upload/v123/folder/name.jpg` → `folder/name` */
export function publicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const uploadAt = parts.findIndex((p) => p === 'upload');
    if (uploadAt < 0) return null;
    const after = parts.slice(uploadAt + 1).filter((p) => !/^v\d+$/.test(p));
    const noTransform = after.filter((p) => !p.includes(',') && !/^[a-z]+_/i.test(p));
    const joined = noTransform.join('/');
    if (!joined) return null;
    return joined.replace(/\.[a-z0-9]+$/i, '');
  } catch {
    return null;
  }
}

async function fetchImageBuffer(url: string): Promise<{ buf: Buffer; contentType?: string } | null> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32) return null;
  return { buf, contentType: res.headers.get('content-type') || undefined };
}

/**
 * Cloudinary 공개 URL이 401이어도 API 서명 URL로 받아 R2에 올린다.
 * 이미 R2 주소면 null (호출측에서 건너뜀).
 */
export async function copyCloudinaryImageToR2(params: {
  url: string;
  publicId?: string | null;
  folder: string;
}): Promise<{ secureUrl: string; publicId: string } | null> {
  const url = params.url.trim();
  if (!url || !isCloudinaryHostedUrl(url)) return null;

  let fetched = await fetchImageBuffer(url);
  const pid = params.publicId?.trim() || publicIdFromCloudinaryUrl(url);
  if (!fetched && isCloudinaryAccountConfigured() && pid && !pid.startsWith('r2:')) {
    const candidates = [
      cloudinary.url(pid, {
        resource_type: 'image',
        type: 'upload',
        sign_url: true,
        secure: true,
      }),
      cloudinary.utils.private_download_url(pid, 'jpg', {
        resource_type: 'image',
        type: 'upload',
        expires_at: Math.round(Date.now() / 1000) + 3600,
      }),
      cloudinary.utils.private_download_url(pid, 'png', {
        resource_type: 'image',
        type: 'upload',
        expires_at: Math.round(Date.now() / 1000) + 3600,
      }),
    ];
    for (const next of candidates) {
      fetched = await fetchImageBuffer(next);
      if (fetched) break;
    }
    if (!fetched) {
      try {
        const resource = (await cloudinary.api.resource(pid, { resource_type: 'image' })) as {
          secure_url?: string;
          url?: string;
        };
        for (const next of [resource.secure_url, resource.url]) {
          if (!next) continue;
          fetched = await fetchImageBuffer(next);
          if (fetched) break;
        }
      } catch {
        /* 계정 비활성·없는 publicId */
      }
    }
  }
  if (!fetched) return null;

  const uploaded = await uploadObjectBuffer({
    folder: params.folder,
    buffer: fetched.buf,
    contentType: fetched.contentType,
    resourceType: 'image',
  });
  return { secureUrl: uploaded.secureUrl, publicId: uploaded.publicId };
}
