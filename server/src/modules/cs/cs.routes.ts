import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { findInquiryIdForCsReport } from './matchInquiryForCs.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { csReportFullInclude } from './csReport.include.js';
import { buildCsReportUpdateData } from './csReport.patch.js';

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
/** 클라이언트에서 리사이즈·압축 후 전송. 여유 있게 상한만 둠 */
const upload = multer({ storage, limits: { fileSize: 12 * 1024 * 1024 } }); // 12MB

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
  const { customerName, customerPhone, content, imageUrls, serviceRating } = req.body as {
    customerName: string;
    customerPhone: string;
    content: string;
    imageUrls?: string[];
    serviceRating?: unknown;
  };
  if (!customerName?.trim() || !customerPhone?.trim() || !content?.trim()) {
    res.status(400).json({ error: '성함, 연락처, 내용을 입력해 주세요.' });
    return;
  }
  const rating = Number(serviceRating);
  if (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: '서비스 품질을 1~5점으로 선택해 주세요.' });
    return;
  }
  const urls = Array.isArray(imageUrls) ? imageUrls : [];
  const inquiryId = await findInquiryIdForCsReport(customerName.trim(), customerPhone.trim());
  const report = await prisma.csReport.create({
    data: {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      content: content.trim(),
      serviceRating: rating,
      imageUrls: urls,
      ...(inquiryId ? { inquiryId } : {}),
    },
  });
  res.json({
    ok: true,
    id: report.id,
    ...(inquiryId ? { inquiryId } : {}),
  });
});

/** 관리자·마케터: C/S 목록 */
router.get('/', authMiddleware, adminOrMarketer, async (_req, res) => {
  const items = await prisma.csReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: csReportFullInclude,
  });
  res.json({ items });
});

/** 관리자·마케터: C/S 상세 */
router.get('/:id', authMiddleware, adminOrMarketer, async (req, res) => {
  const { id } = req.params;
  const item = await prisma.csReport.findUnique({
    where: { id },
    include: csReportFullInclude,
  });
  if (!item) {
    res.status(404).json({ error: 'C/S를 찾을 수 없습니다.' });
    return;
  }
  res.json(item);
});

/** 관리자·마케터: C/S 상태/메모/처리완료 */
router.patch('/:id', authMiddleware, adminOrMarketer, async (req, res) => {
  const { id } = req.params;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as { status?: string; memo?: string | null; completionMethod?: string | null };
  const item = await prisma.csReport.findUnique({ where: { id } });
  if (!item) {
    res.status(404).json({ error: 'C/S를 찾을 수 없습니다.' });
    return;
  }
  const built = buildCsReportUpdateData({ status: item.status }, body, user);
  if (!built.ok) {
    res.status(400).json({ error: built.error });
    return;
  }
  const updated = await prisma.csReport.update({
    where: { id },
    data: built.data,
    include: csReportFullInclude,
  });
  res.json(updated);
});

export default router;
