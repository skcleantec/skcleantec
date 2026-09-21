import { uploadObjectBuffer } from '../../lib/objectStorage.js';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const MAX_PNG_BYTES = 400_000;

export function parseGuideSignaturePngDataUrl(raw: unknown): Buffer | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (!m) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(m[1].replace(/\s/g, ''), 'base64');
  } catch {
    return null;
  }
  if (buf.length < 80 || buf.length > MAX_PNG_BYTES) return null;
  if (PNG_MAGIC.some((b, i) => buf[i] !== b)) return null;
  return buf;
}

export async function persistOrderFormGuideSignature(params: {
  orderFormId: string;
  png: Buffer;
}): Promise<{ signatureUrl: string }> {
  const stored = await uploadObjectBuffer({
    folder: `cbiseo/orderforms/${params.orderFormId}/guide-sign`,
    buffer: params.png,
    contentType: 'image/png',
    resourceType: 'image',
    fileNameHint: 'guide-sign.png',
  });
  return { signatureUrl: stored.secureUrl };
}
