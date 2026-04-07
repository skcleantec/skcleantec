import { Router } from 'express';
import type { Request } from 'express';
import multer from 'multer';
import { CleaningPhotoPhase } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  deletePhotoFromDbAndCloudinary,
  listPhotos,
  uploadImageBuffer,
} from './inquiryCleaningPhotos.service.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

/** 다중 `images` + 단일 `image` 호환 (최대 20장) */
const uploadCleaningImages = upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'image', maxCount: 1 },
]);

function collectUploadedFiles(req: Request): Express.Multer.File[] {
  const raw = req.files as Record<string, Express.Multer.File[]> | undefined;
  return [...(raw?.images ?? []), ...(raw?.image ?? [])];
}

const router = Router({ mergeParams: true });

function serialize(row: {
  id: string;
  inquiryId: string;
  phase: CleaningPhotoPhase;
  secureUrl: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
  uploadedBy: { id: string; name: string };
}) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    phase: row.phase,
    secureUrl: row.secureUrl,
    width: row.width,
    height: row.height,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 담당 팀장만 — 목록 */
router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const ok = await prisma.inquiry.findFirst({
    where: { id: inquiryId, assignments: { some: { teamLeaderId: userId } } },
    select: { id: true },
  });
  if (!ok) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const items = await listPhotos(inquiryId);
  res.json({ items: items.map(serialize) });
});

/** 담당 팀장만 — 업로드 (multipart: images[] 또는 image, phase=BEFORE|AFTER) */
router.post('/', uploadCleaningImages, async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      error:
        'Cloudinary가 설정되지 않았습니다. 서버에 CLOUDINARY_URL 또는 CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET을 설정하세요.',
    });
    return;
  }
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const files = collectUploadedFiles(req);
  if (files.length === 0) {
    res.status(400).json({ error: '이미지 파일을 선택해주세요.' });
    return;
  }
  const phaseRaw = typeof req.body?.phase === 'string' ? req.body.phase.toUpperCase() : 'BEFORE';
  const phase: CleaningPhotoPhase = phaseRaw === 'AFTER' ? 'AFTER' : 'BEFORE';

  const ok = await prisma.inquiry.findFirst({
    where: { id: inquiryId, assignments: { some: { teamLeaderId: userId } } },
    select: { id: true },
  });
  if (!ok) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }

  const createdRows: Awaited<ReturnType<typeof uploadImageBuffer>>[] = [];
  try {
    for (const file of files) {
      if (!file.buffer?.length) continue;
      const created = await uploadImageBuffer({
        inquiryId,
        phase,
        uploadedById: userId,
        buffer: file.buffer,
        mimetype: file.mimetype,
      });
      createdRows.push(created);
    }
    if (createdRows.length === 0) {
      res.status(400).json({ error: '유효한 이미지 파일이 없습니다.' });
      return;
    }
    const items = createdRows.map(serialize);
    res.status(201).json({ items, item: items[0] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'CLOUDINARY_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Cloudinary 설정을 확인하세요.' });
      return;
    }
    console.error('[team cleaning-photo upload]', e);
    res.status(500).json({ error: '업로드에 실패했습니다.' });
  }
});

/** 본인이 올린 사진만 삭제 */
router.delete('/:photoId', async (req, res) => {
  const { inquiryId, photoId } = req.params as { inquiryId: string; photoId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;

  const ok = await prisma.inquiry.findFirst({
    where: { id: inquiryId, assignments: { some: { teamLeaderId: userId } } },
    select: { id: true },
  });
  if (!ok) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }

  const photo = await prisma.inquiryCleaningPhoto.findFirst({
    where: { id: photoId, inquiryId, uploadedById: userId },
  });
  if (!photo) {
    res.status(404).json({ error: '사진을 찾을 수 없거나 삭제 권한이 없습니다.' });
    return;
  }

  await deletePhotoFromDbAndCloudinary(photoId);
  res.json({ ok: true });
});

export default router;
