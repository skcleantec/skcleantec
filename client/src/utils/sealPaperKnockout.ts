/** 흰 종이에 찍은 도장 사진에서 종이색을 지우고, 잉크만 남긴 PNG를 만든다. */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 읽지 못했습니다. JPG 또는 PNG로 다시 올려 주세요.'));
    };
    img.src = url;
  });
}

export async function knockoutSealPaper(file: File, threshold: number): Promise<Blob> {
  const img = await loadImage(file);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('도장 그림을 처리하지 못했습니다.');
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const satLimit = Math.max(28, threshold * 0.75);
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let ink = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const paper = lum >= 255 - threshold && max - min <= satLimit;
    if (paper) {
      d[i + 3] = 0;
      continue;
    }
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
    ink += 1;
  }
  if (ink < 40) {
    throw new Error('도장이 잘 안 보입니다. 흰 종이에 더 진하게 찍어 다시 올려 주세요.');
  }
  ctx.putImageData(image, 0, 0);
  const pad = 12;
  const sx = Math.max(0, Math.floor(minX) - pad);
  const sy = Math.max(0, Math.floor(minY) - pad);
  const sw = Math.min(w - sx, Math.ceil(maxX - minX) + pad * 2);
  const sh = Math.min(h - sy, Math.ceil(maxY - minY) + pad * 2);
  const out = document.createElement('canvas');
  out.width = Math.max(1, sw);
  out.height = Math.max(1, sh);
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('도장 그림을 처리하지 못했습니다.');
  outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('도장 그림을 만들지 못했습니다.');
  return blob;
}
