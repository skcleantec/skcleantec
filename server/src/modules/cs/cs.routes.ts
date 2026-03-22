import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';

const router = Router();

// Railway Volume 마운트 경로 또는 로컬 uploads 폴더
const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads');
const csDir = path.join(uploadDir, 'cs');
try {
  fs.mkdirSync(csDir, { recursive: true });
} catch {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, csDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

/** 서버 공개 URL (Railway: RAILWAY_PUBLIC_DOMAIN, 로컬: PUBLIC_URL) */
function getBaseUrl(): string {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
}

/** 공개: 이미지 업로드 (C/S 제출용) - Railway Volume에 저장 */
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '이미지를 선택해 주세요.' });
    return;
  }
  const url = `${getBaseUrl()}/uploads/cs/${req.file.filename}`;
  res.json({ url });
});

/** 공개: C/S 제출 */
router.post('/submit', async (req, res) => {
  const { customerName, customerPhone, content, imageUrls } = req.body as {
    customerName: string;
    customerPhone: string;
    content: string;
    imageUrls?: string[];
  };
  if (!customerName?.trim() || !customerPhone?.trim() || !content?.trim()) {
    res.status(400).json({ error: '성함, 연락처, 내용을 입력해 주세요.' });
    return;
  }
  const urls = Array.isArray(imageUrls) ? imageUrls : [];
  const report = await prisma.csReport.create({
    data: {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      content: content.trim(),
      imageUrls: urls,
    },
  });
  res.json({ ok: true, id: report.id });
});

/** 관리자: C/S 목록 */
router.get('/', authMiddleware, adminOnly, async (_req, res) => {
  const items = await prisma.csReport.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

/** 관리자: C/S 상세 */
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const item = await prisma.csReport.findUnique({ where: { id } });
  if (!item) {
    res.status(404).json({ error: 'C/S를 찾을 수 없습니다.' });
    return;
  }
  res.json(item);
});

/** 관리자: C/S 상태/메모 수정 */
router.patch('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { status, memo } = req.body as { status?: string; memo?: string };
  const item = await prisma.csReport.findUnique({ where: { id } });
  if (!item) {
    res.status(404).json({ error: 'C/S를 찾을 수 없습니다.' });
    return;
  }
  const updated = await prisma.csReport.update({
    where: { id },
    data: {
      ...(status != null && { status }),
      ...(memo != null && { memo }),
    },
  });
  res.json(updated);
});

export default router;
