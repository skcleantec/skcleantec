import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { cloudinary, isCloudinaryAccountConfigured } from './cloudinary.js';
import { getR2Client, getR2Config, isR2Configured } from './r2.js';

export const R2_PUBLIC_ID_PREFIX = 'r2:';

export function isObjectStorageReady(): boolean {
  return isR2Configured() || isCloudinaryAccountConfigured();
}

export function isR2StoredId(publicId: string): boolean {
  return publicId.startsWith(R2_PUBLIC_ID_PREFIX);
}

function normalizeFolder(folder: string): string {
  const trimmed = folder.replace(/^\/+|\/+$/g, '').replace(/skcleanteck\//g, 'cbiseo/');
  return trimmed.startsWith('cbiseo/') ? trimmed : `cbiseo/${trimmed}`;
}

function extFromContentType(contentType: string, resourceType: 'image' | 'raw'): string {
  const c = contentType.toLowerCase();
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg';
  if (c.includes('png')) return 'png';
  if (c.includes('webp')) return 'webp';
  if (c.includes('gif')) return 'gif';
  if (c.includes('heic')) return 'heic';
  if (c.includes('heif')) return 'heif';
  if (c.includes('pdf')) return 'pdf';
  return resourceType === 'raw' ? 'bin' : 'jpg';
}

function publicUrlForKey(base: string, key: string): string {
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return `${base}/${encoded}`;
}

export type StoredObject = {
  publicId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
};

export async function uploadObjectBuffer(params: {
  folder: string;
  buffer: Buffer;
  contentType?: string;
  resourceType?: 'image' | 'raw';
  fileNameHint?: string;
}): Promise<StoredObject> {
  if (!isObjectStorageReady()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
  const resourceType = params.resourceType ?? 'image';
  const contentType =
    params.contentType?.trim() ||
    (resourceType === 'raw' ? 'application/pdf' : 'image/jpeg');

  const r2 = getR2Config();
  if (r2) {
    const ext = params.fileNameHint?.includes('.')
      ? params.fileNameHint.split('.').pop()!.replace(/[^\w]/g, '').slice(0, 8) ||
        extFromContentType(contentType, resourceType)
      : extFromContentType(contentType, resourceType);
    const key = `${normalizeFolder(params.folder)}/${randomUUID()}.${ext}`;
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: contentType,
      }),
    );
    return {
      publicId: `${R2_PUBLIC_ID_PREFIX}${key}`,
      secureUrl: publicUrlForKey(r2.publicBaseUrl, key),
      width: null,
      height: null,
    };
  }

  const result = await new Promise<{
    public_id: string;
    secure_url: string;
    width?: number;
    height?: number;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: params.folder,
        resource_type: resourceType,
        ...(resourceType === 'raw' && params.fileNameHint?.endsWith('.pdf')
          ? { format: 'pdf' }
          : {}),
      },
      (err, res) => {
        if (err) reject(err);
        else if (!res?.public_id || !res.secure_url) reject(new Error('cloudinary_upload_failed'));
        else {
          resolve(res as { public_id: string; secure_url: string; width?: number; height?: number });
        }
      },
    );
    stream.end(params.buffer);
  });
  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width ?? null,
    height: result.height ?? null,
  };
}

export async function destroyStoredObject(
  publicId: string | null | undefined,
  resourceType: 'image' | 'raw' = 'image',
): Promise<void> {
  const id = publicId?.trim();
  if (!id) return;
  if (isR2StoredId(id)) {
    const r2 = getR2Config();
    if (!r2) return;
    const key = id.slice(R2_PUBLIC_ID_PREFIX.length);
    try {
      await getR2Client().send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
    } catch (e) {
      console.warn('[object-storage] r2 destroy:', e);
    }
    return;
  }
  if (!isCloudinaryAccountConfigured()) return;
  try {
    await cloudinary.uploader.destroy(id, { resource_type: resourceType });
  } catch (e) {
    console.warn('[object-storage] cloudinary destroy:', e);
  }
}

export async function fetchStoredObjectBuffer(publicId: string): Promise<Buffer> {
  const id = publicId.trim();
  if (isR2StoredId(id)) {
    const r2 = getR2Config();
    if (!r2) throw new Error('R2_NOT_CONFIGURED');
    const key = id.slice(R2_PUBLIC_ID_PREFIX.length);
    const out = await getR2Client().send(new GetObjectCommand({ Bucket: r2.bucket, Key: key }));
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes?.length) throw new Error('R2_EMPTY_OBJECT');
    return Buffer.from(bytes);
  }
  if (!isCloudinaryAccountConfigured()) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }
  const url = cloudinary.utils.private_download_url(id, '', {
    resource_type: 'raw',
    type: 'upload',
    expires_at: Math.round(Date.now() / 1000) + 3600,
  });
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw Object.assign(new Error('교육자료 파일을 불러올 수 없습니다.'), {
      code: 'upstream',
      status: res.status,
    });
  }
  return Buffer.from(await res.arrayBuffer());
}
