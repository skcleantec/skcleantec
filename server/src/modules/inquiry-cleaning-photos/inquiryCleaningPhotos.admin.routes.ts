import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import type { CleaningPhotoPhase } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  deletePhotoFromDbAndCloudinary,
  listPhotos,
  uploadImageBuffer,
} from './inquiryCleaningPhotos.service.js';
import { canAdminOrMarketerViewInquiry } from './inquiryCleaningPhotos.access.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

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

router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await canAdminOrMarketerViewInquiry(user, inquiryId))) {
    res.status(404).json({ error: '접수를 찾을 수 없거나 권한이 없습니다.' });
    return;
  }
  const items = await listPhotos(inquiryId);
  res.json({ items: items.map(serialize) });
});

/** 관리자 현장 대행 업로드 등 — 접수 조회 권한이 있으면 업로드 가능 */
router.post('/', upload.single('image'), async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      error:
        'Cloudinary가 설정되지 않았습니다. 서버에 CLOUDINARY_URL 또는 CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET을 설정하세요.',
    });
    return;
  }
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await canAdminOrMarketerViewInquiry(user, inquiryId))) {
    res.status(404).json({ error: '접수를 찾을 수 없거나 권한이 없습니다.' });
    return;
  }
  const file = req.file;
  if (!file?.buffer) {
    res.status(400).json({ error: '이미지 파일을 선택해주세요.' });
    return;
  }
  const phaseRaw = typeof req.body?.phase === 'string' ? req.body.phase.toUpperCase() : 'BEFORE';
  const phase: CleaningPhotoPhase = phaseRaw === 'AFTER' ? 'AFTER' : 'BEFORE';

  try {
    const created = await uploadImageBuffer({
      inquiryId,
      phase,
      uploadedById: user.userId,
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
    res.status(201).json({ item: serialize(created) });
  } catch (e) {
    console.error('[admin cleaning-photo upload]', e);
    res.status(500).json({ error: '업로드에 실패했습니다.' });
  }
});

/** 영구 삭제 — 본인 비밀번호 확인 (프로젝트 삭제 규칙) */
router.delete('/:photoId', async (req, res) => {
  const { inquiryId, photoId } = req.params as { inquiryId: string; photoId: string };
  const body = req.body as { password?: string };
  const password = body.password != null ? String(body.password) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await canAdminOrMarketerViewInquiry(user, inquiryId))) {
    res.status(404).json({ error: '접수를 찾을 수 없거나 권한이 없습니다.' });
    return;
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }

  const photo = await prisma.inquiryCleaningPhoto.findFirst({
    where: { id: photoId, inquiryId },
  });
  if (!photo) {
    res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
    return;
  }

  await deletePhotoFromDbAndCloudinary(photoId);
  res.json({ ok: true });
});

export default router;
