import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { destroyStoredObject, uploadObjectBuffer } from '../../lib/objectStorage.js';
import { isHeic, pdfPageCount, safeFileName, uploadKind, type UploadFileMeta } from './messageAttachment.logic.js';

const PREVIEW_EDGE = 1280;
const THUMB_EDGE = 400;

export type StoredAttachment = {
  kind: 'image' | 'pdf';
  fileName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  originalUrl: string;
  previewUrl: string | null;
  thumbUrl: string | null;
  storageKey: string;
};

async function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  const convert = (await import('heic-convert')).default;
  const out = await convert({ buffer, format: 'JPEG', quality: 0.9 });
  return Buffer.from(out);
}

async function resizeJpeg(buffer: Buffer, edge: number): Promise<{ buffer: Buffer; width: number; height: number }> {
  const out = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height };
}

export async function storeMessageFile(params: {
  tenantId: string;
  file: UploadFileMeta & { buffer: Buffer };
}): Promise<StoredAttachment> {
  const kind = uploadKind(params.file);
  if (!kind) throw new Error('FILE_TYPE');
  const fileName = safeFileName(params.file.originalname);
  const folder = `cbiseo/messages/${params.tenantId}`;
  const id = randomUUID();

  if (kind === 'pdf') {
    const stored = await uploadObjectBuffer({
      folder,
      buffer: params.file.buffer,
      contentType: 'application/pdf',
      resourceType: 'raw',
      fileNameHint: `${id}.pdf`,
      stableFileName: `${id}.pdf`,
    });
    return {
      kind,
      fileName,
      sizeBytes: params.file.size,
      width: null,
      height: null,
      pageCount: pdfPageCount(params.file.buffer),
      originalUrl: stored.secureUrl,
      previewUrl: null,
      thumbUrl: null,
      storageKey: stored.publicId,
    };
  }

  const originalType = isHeic(params.file)
    ? 'image/heic'
    : params.file.mimetype.toLowerCase().includes('png')
      ? 'image/png'
      : params.file.mimetype.toLowerCase().includes('webp')
        ? 'image/webp'
        : 'image/jpeg';
  const ext = isHeic(params.file) ? 'heic' : originalType === 'image/png' ? 'png' : originalType === 'image/webp' ? 'webp' : 'jpg';
  const original = await uploadObjectBuffer({
    folder,
    buffer: params.file.buffer,
    contentType: originalType,
    resourceType: 'image',
    fileNameHint: `${id}.${ext}`,
    stableFileName: `${id}.${ext}`,
  });

  try {
  let raster = params.file.buffer;
  if (isHeic(params.file)) {
    try {
      raster = await heicToJpeg(params.file.buffer);
    } catch {
      raster = params.file.buffer;
    }
  }
  let meta = await sharp(raster, { failOn: 'none' }).rotate().metadata();
  if ((meta.width == null || meta.height == null) && isHeic(params.file)) {
    const jpeg = await heicToJpeg(params.file.buffer);
    raster = jpeg;
    meta = await sharp(jpeg, { failOn: 'none' }).rotate().metadata();
  }
  const preview = await resizeJpeg(raster, PREVIEW_EDGE);
  const thumb = await resizeJpeg(raster, THUMB_EDGE);
  const [previewStored, thumbStored] = await Promise.all([
    uploadObjectBuffer({
      folder,
      buffer: preview.buffer,
      contentType: 'image/jpeg',
      resourceType: 'image',
      stableFileName: `${id}-preview.jpg`,
    }),
    uploadObjectBuffer({
      folder,
      buffer: thumb.buffer,
      contentType: 'image/jpeg',
      resourceType: 'image',
      stableFileName: `${id}-thumb.jpg`,
    }),
  ]);
  return {
    kind,
    fileName,
    sizeBytes: params.file.size,
    width: meta.width ?? preview.width,
    height: meta.height ?? preview.height,
    pageCount: null,
    originalUrl: original.secureUrl,
    previewUrl: previewStored.secureUrl,
    thumbUrl: thumbStored.secureUrl,
    storageKey: [original.publicId, previewStored.publicId, thumbStored.publicId].join('\n'),
  };
  } catch (error) {
    await destroyStoredObject(original.publicId, 'image');
    throw error;
  }
}
