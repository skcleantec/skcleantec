import multer from 'multer';
import { isObjectStorageReady, uploadObjectBuffer } from './objectStorage.js';

export const browserImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export async function uploadBrowserImageToStore(params: {
  folder: string;
  file: Express.Multer.File;
}): Promise<{ publicId: string; secureUrl: string }> {
  if (!isObjectStorageReady()) {
    throw Object.assign(new Error('이미지 저장소가 준비되지 않았습니다.'), { code: 'storage' as const });
  }
  const result = await uploadObjectBuffer({
    folder: params.folder,
    buffer: params.file.buffer,
    contentType: params.file.mimetype || 'image/png',
    resourceType: 'image',
    fileNameHint: params.file.originalname,
  });
  return { publicId: result.publicId, secureUrl: result.secureUrl };
}
