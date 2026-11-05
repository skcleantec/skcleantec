/** 견적서 직인 PNG — 투명 여백 잘라 정사각 유지 */

const TRIM_ALPHA_MIN = 8;

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('직인 이미지를 읽지 못했습니다.'));
    img.src = url;
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('직인 이미지를 읽지 못했습니다.'));
    };
    img.src = url;
  });
}

function trimImageToSquareCanvas(img: HTMLImageElement): HTMLCanvasElement | null {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w < 1 || h < 1) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
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
  if (maxX < minX || maxY < minY) return canvas;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const side = Math.max(bw, bh);
  const out = document.createElement('canvas');
  out.width = side;
  out.height = side;
  const octx = out.getContext('2d');
  if (!octx) return null;
  const dx = Math.floor((side - bw) / 2);
  const dy = Math.floor((side - bh) / 2);
  octx.drawImage(canvas, minX, minY, bw, bh, dx, dy, bw, bh);
  return out;
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('직인 이미지를 만들지 못했습니다.');
  return blob;
}

/** 업로드 전 — File/Blob PNG 투명 여백 trim → 정사각 PNG Blob */
export async function trimTransparentPngFileToSquare(file: Blob): Promise<Blob> {
  try {
    const img = await loadImageFromBlob(file);
    const canvas = trimImageToSquareCanvas(img);
    if (!canvas) return file;
    return await canvasToPngBlob(canvas);
  } catch {
    return file;
  }
}

/**
 * 이미 저장된 직인 URL을 표시용으로 trim한 object URL.
 * 호출측에서 revoke 필요.
 */
export async function trimTransparentPngUrlToObjectUrl(url: string): Promise<string> {
  const img = await loadImageFromUrl(url);
  const canvas = trimImageToSquareCanvas(img);
  if (!canvas) return url;
  const blob = await canvasToPngBlob(canvas);
  return URL.createObjectURL(blob);
}
