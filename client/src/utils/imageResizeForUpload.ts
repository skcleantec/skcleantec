/**
 * 업로드용 — 긴 변 기준 리사이즈 + JPEG 압축 (multer 8MB·네트워크 부담 완화)
 */
export const UPLOAD_MAX_EDGE_PX = 1920;
const TARGET_MAX_BYTES = 1.75 * 1024 * 1024;
const MIN_QUALITY = 0.52;
const QUALITY_STEP = 0.07;
const MULTER_MAX_BYTES = 8 * 1024 * 1024;

export const HEIC_UPLOAD_HINT =
  'HEIC 사진은 JPG로 변환되지 않으면 일부 기기에서 업로드가 실패할 수 있습니다. 사진 앱에서 JPG로 저장하거나 카메라 촬영 버튼을 이용해 주세요.';

export function isHeicFile(file: File): boolean {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  return t === 'image/heic' || t === 'image/heif' || n.endsWith('.heic') || n.endsWith('.heif');
}

/** 인라인 카메라 촬영본 — 이미 업로드용으로 압축됨 */
export function isInlineCaptureUploadFile(file: File): boolean {
  return file.type === 'image/jpeg' && /^preclean-\d+\.jpg$/i.test(file.name);
}

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
      quality,
    );
  });
}

async function encodeCanvasToUploadFile(canvas: HTMLCanvasElement, baseName: string): Promise<File> {
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
    throw new Error('이미지 변환에 실패했습니다.');
  }
  const base = baseName.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * Canvas/video 프레임 → 업로드용 JPEG (한 번만 인코딩)
 */
export async function encodeVideoFrameToUploadFile(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  fileBaseName = `preclean-${Date.now()}`,
): Promise<File> {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('카메라 준비 중입니다. 잠시 후 다시 시도해 주세요.');
  }
  let w = sourceWidth;
  let h = sourceHeight;
  const maxEdge = Math.max(w, h);
  if (maxEdge > UPLOAD_MAX_EDGE_PX) {
    const scale = UPLOAD_MAX_EDGE_PX / maxEdge;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('촬영에 실패했습니다.');
  ctx.drawImage(source, 0, 0, w, h);
  return encodeCanvasToUploadFile(canvas, fileBaseName);
}

/**
 * @returns 업로드용 File (JPEG). GIF는 그대로. HEIC는 변환 시도, 실패 시 원본(서버 HEIC 허용).
 */
export async function prepareImageFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  if (file.type === 'image/gif') {
    return file;
  }
  if (isInlineCaptureUploadFile(file)) {
    return file;
  }

  let img: HTMLImageElement;
  try {
    img = await loadImageElement(file);
  } catch {
    if (isHeicFile(file)) {
      if (file.size > MULTER_MAX_BYTES) {
        throw new Error(`${HEIC_UPLOAD_HINT} (용량이 너무 큽니다.)`);
      }
      return file;
    }
    if (file.size > MULTER_MAX_BYTES) {
      throw new Error('이미지 용량이 너무 큽니다. 다른 사진을 선택하거나 카메라 촬영을 이용해 주세요.');
    }
    return file;
  }

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w <= 0 || h <= 0) {
    return file;
  }

  const maxEdge = Math.max(w, h);
  if (maxEdge > UPLOAD_MAX_EDGE_PX) {
    const scale = UPLOAD_MAX_EDGE_PX / maxEdge;
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

  return encodeCanvasToUploadFile(canvas, file.name.replace(/\.[^.]+$/, '') || 'image');
}

/** 여러 장 — 순차 변환 (실패 시 해당 파일만 throw) */
export async function prepareImageFilesForUpload(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    out.push(await prepareImageFileForUpload(f));
  }
  return out;
}
