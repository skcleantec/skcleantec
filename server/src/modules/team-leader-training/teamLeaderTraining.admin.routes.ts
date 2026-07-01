import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  getTeamLeaderTrainingMeta,
  TEAM_LEADER_TRAINING_PDF_FILENAME,
  uploadTeamLeaderTrainingPdf,
} from './teamLeaderTraining.service.js';

const router = Router();

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    cb(null, ok);
  },
});

router.use(authMiddleware, adminOnly);

/** GET /api/admin/team-leader-training — 등록 여부·파일명 */
router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    const meta = await getTeamLeaderTrainingMeta(tenantId);
    res.json(meta);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'forbidden') {
      res.status(403).json({ error: err.message ?? 'SK클린텍 전용 기능입니다.' });
      return;
    }
    throw e;
  }
});

/** POST /api/admin/team-leader-training — PDF 교체 업로드 */
router.post('/', pdfUpload.single('pdf'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).json({ error: 'PDF 파일을 선택해 주세요.' });
    return;
  }
  try {
    const meta = await uploadTeamLeaderTrainingPdf({
      tenantId,
      buffer: file.buffer,
      fileName: TEAM_LEADER_TRAINING_PDF_FILENAME,
    });
    res.json(meta);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'forbidden') {
      res.status(403).json({ error: err.message ?? 'SK클린텍 전용 기능입니다.' });
      return;
    }
    if (err.code === 'cloudinary') {
      res.status(503).json({ error: err.message ?? '파일 저장소가 준비되지 않았습니다.' });
      return;
    }
    console.error('[team-leader-training] upload failed', e);
    res.status(500).json({ error: '교육자료 업로드에 실패했습니다.' });
  }
});

export default router;
