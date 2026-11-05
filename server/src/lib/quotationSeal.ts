import { createCanvas, loadImage } from '@napi-rs/canvas';
import { isHttpsHostedImageUrl } from './storedObjectUrl.js';

/** @see shared/quotationSeal.ts — 클라이언트와 동기화 */
export const QUOTATION_SEAL_SOURCE_PX = 200;
export const QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT = 72;
export const QUOTATION_SEAL_DISPLAY_WIDTH_MIN = 48;
export const QUOTATION_SEAL_DISPLAY_WIDTH_MAX = 120;

const QUOTATION_SEAL_LEGACY_WIDTH_CEILING = 48;
/** 이 이하 알파는 여백으로 본다 */
const TRIM_ALPHA_MIN = 8;

export function resolveQuotationSealDisplayWidth(raw: number | undefined | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const rounded = Math.round(raw);
    if (rounded <= QUOTATION_SEAL_LEGACY_WIDTH_CEILING) {
      return QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT;
    }
    return Math.min(
      QUOTATION_SEAL_DISPLAY_WIDTH_MAX,
      Math.max(QUOTATION_SEAL_DISPLAY_WIDTH_MIN, rounded),
    );
  }
  return QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT;
}

/**
 * PNG 투명 여백을 잘라 정사각으로 맞춘다. 실패·비PNG면 원본 반환.
 */
export async function trimTransparentPngToSquare(pngBuf: Buffer): Promise<Buffer> {
  try {
    const img = await loadImage(pngBuf);
    const w = img.width;
    const h = img.height;
    if (w < 1 || h < 1) return pngBuf;

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3] ?? 0;
        if (a > TRIM_ALPHA_MIN) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return pngBuf;

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const side = Math.max(bw, bh);
    const out = createCanvas(side, side);
    const octx = out.getContext('2d');
    const dx = Math.floor((side - bw) / 2);
    const dy = Math.floor((side - bh) / 2);
    octx.drawImage(canvas, minX, minY, bw, bh, dx, dy, bw, bh);
    return out.toBuffer('image/png');
  } catch {
    return pngBuf;
  }
}

export function tenantCompanySealFolder(tenantId: string): string {
  return `skcleanteck/tenants/${tenantId}/company-seal`;
}

export function tenantCompanySealLooksValid(
  publicIdRaw: string | null | undefined,
  urlRaw: string | null | undefined,
  tenantId: string,
): boolean {
  const url = (urlRaw ?? '').trim();
  const pid = (publicIdRaw ?? '').trim();
  if (!url || !pid || !isHttpsHostedImageUrl(url)) return false;
  if (pid.startsWith('r2:')) {
    return pid.includes(`/tenants/${tenantId}/company-seal`);
  }
  const prefix = `${tenantCompanySealFolder(tenantId)}/`;
  return pid.startsWith(prefix);
}
