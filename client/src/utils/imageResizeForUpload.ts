/**
 * 고객 업로드용 — 긴 변 기준 리사이즈 + JPEG 압축으로 용량 절감 (multer 상한·네트워크 부담 완화)
 */
const MAX_EDGE_PX = 1920;
const TARGET_MAX_BYTES = 1.75 * 1024 * 1024;
const MIN_QUALITY = 0.52;
const QUALITY_STEP = 0.07;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러올 수 없습니다.'));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('이미지 변환에 실패했습니다.'));
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * @returns 업로드용 File (JPEG). GIF는 그대로 반환(애니메이션 보존).
 */
export async function prepareImageFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  if (file.type === 'image/gif') {
    return file;
  }

  let img: HTMLImageElement;
  try {
    img = await loadImageElement(file);
  } catch {
    return file;
  }

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w <= 0 || h <= 0) {
    return file;
  }

  const maxEdge = Math.max(w, h);
  if (maxEdge > MAX_EDGE_PX) {
    const scale = MAX_EDGE_PX / maxEdge;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return file;
  }
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.88;
  let blob: Blob | null = null;
  for (let i = 0; i < 12; i++) {
    blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= TARGET_MAX_BYTES || quality <= MIN_QUALITY) {
      break;
    }
    quality -= QUALITY_STEP;
  }

  if (!blob) {
    return file;
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
