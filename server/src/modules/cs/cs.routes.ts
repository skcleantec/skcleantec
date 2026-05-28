import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { findInquiryIdForCsReport } from './matchInquiryForCs.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { csReportFullInclude } from './csReport.include.js';
import { buildCsReportUpdateData } from './csReport.patch.js';
import { notifyCsReportNavBadges, getEmployedStaffUserIds } from '../realtime/navBadgeNotify.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import { csCreatedAtRangeFromQuery } from './csListDateRange.js';
import type { Prisma } from '@prisma/client';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { resolvePublicTenantIdFromRequest } from '../tenants/publicRequestTenant.js';
import { assertTenantAllowsPublicService, PublicTenantAccessError, publicTenantAccessHttpStatus } from '../tenants/publicTenantAccess.js';

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
  let submitTenantId: string;
  try {
    submitTenantId = await resolvePublicTenantIdFromRequest(req);
    await assertTenantAllowsPublicService(submitTenantId);
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    throw e;
  }
  const inquiryId = await findInquiryIdForCsReport(
    customerName.trim(),
    customerPhone.trim(),
    submitTenantId,
  );
  let tenantId = submitTenantId;
  if (inquiryId) {
    const inv = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { tenantId: true },
    });
    if (inv?.tenantId) tenantId = inv.tenantId;
  }
  const report = await prisma.csReport.create({
    data: {
      tenantId,
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
  void notifyCsReportNavBadges(report.inquiryId, undefined, report.tenantId);
});

/** 관리자·마케터: C/S 목록 (접수일 필터·페이지네이션) */
router.get('/', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const q = req.query as Record<string, string | undefined>;
  const range = csCreatedAtRangeFromQuery({
    datePreset: q.datePreset,
    month: q.month,
    day: q.day,
  });
  const where: Prisma.CsReportWhereInput = {
    tenantId,
    createdAt: { gte: range.gte, lte: range.lte },
  };
  const parsedLimit = Number.parseInt(String(q.limit ?? '30'), 10);
  const parsedOffset = Number.parseInt(String(q.offset ?? '0'), 10);
  const take = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 30;
  const skip = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const [total, items] = await Promise.all([
    prisma.csReport.count({ where }),
    prisma.csReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: csReportFullInclude,
    }),
  ]);
  res.json({ items, total });
});

/** 관리자·마케터: 미처리(접수) C/S 건수 — 상단 메뉴 배지용 */
router.get('/pending-count', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const count = await prisma.csReport.count({ where: { tenantId, status: 'RECEIVED' } });
  res.json({ count });
});

/** 관리자·마케터: C/S를 팀장/타업체 계정에 전달(또는 전달 해제). 접수 미연결·미배정 건 대응 */
router.post('/:id/forward', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const body = req.body as { userId?: unknown };
  const raw = body.userId;
  const nextId =
    raw === null || raw === undefined || raw === '' ? null : String(raw).trim() || null;

  const existing = await prisma.csReport.findFirst({
    where: { id, tenantId },
    select: { id: true, inquiryId: true, forwardedToUserId: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'C/S를 찾을 수 없습니다.' });
    return;
  }

  if (nextId) {
    const u = await prisma.user.findFirst({
      where: {
        id: nextId,
        tenantId,
        isActive: true,
        role: { in: ['TEAM_LEADER', 'EXTERNAL_PARTNER'] },
      },
      select: { id: true, hireDate: true, resignationDate: true },
    });
    if (!u) {
      res.status(400).json({ error: '팀장 또는 타업체 담당 계정만 지정할 수 있습니다.' });
      return;
    }
    if (!isUserEmployedOnYmd(u.hireDate, u.resignationDate, kstTodayYmd())) {
      res.status(400).json({ error: '재직 중인 팀장·타업체만 지정할 수 있습니다.' });
      return;
    }
  }

  const prevForward = existing.forwardedToUserId;
  const updated = await prisma.csReport.update({
    where: { id },
    data: { forwardedToUserId: nextId },
    include: csReportFullInclude,
  });
  res.json(updated);
  void notifyCsReportNavBadges(updated.inquiryId, [
    prevForward,
    updated.forwardedToUserId,
  ], tenantId);
});

/** 관리자·마케터: C/S 상세 열람 — 접수(RECEIVED)면 처리중(PROCESSING)으로 자동 전환(미확인 배지 해제) */
router.post('/:id/acknowledge', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const item = await prisma.csReport.findFirst({
    where: { id, tenantId },
    include: csReportFullInclude,
  });
  if (!item) {
    res.status(404).json({ error: 'C/S를 찾을 수 없습니다.' });
    return;
  }
  if (item.status !== 'RECEIVED') {
    res.json(item);
    return;
  }
  const updated = await prisma.csReport.update({
    where: { id },
    data: { status: 'PROCESSING' },
    include: csReportFullInclude,
  });
  res.json(updated);
  void notifyCsReportNavBadges(
    updated.inquiryId,
    updated.forwardedToUserId ? [updated.forwardedToUserId] : [],
    tenantId,
  );
});

/** 관리자·마케터: C/S 상세 */
router.get('/:id', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const item = await prisma.csReport.findFirst({
    where: { id, tenantId },
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
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as {
    status?: string;
    memo?: string | null;
    completionMethod?: string | null;
    asServiceDate?: string | null;
  };
  const item = await prisma.csReport.findFirst({ where: { id, tenantId } });
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
  void notifyCsReportNavBadges(
    updated.inquiryId,
    updated.forwardedToUserId ? [updated.forwardedToUserId] : [],
    tenantId,
  );
  if (Object.prototype.hasOwnProperty.call(built.data, 'asServiceDate')) {
    void getEmployedStaffUserIds(tenantId).then((ids) => notifyInboxRefresh(ids));
  }
});

/** 관리자만 — 비밀번호 확인 후 C/S 영구 삭제 */
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const body = req.body as { password?: unknown };
  const password = body.password != null ? String(body.password) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
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

  const existing = await prisma.csReport.findFirst({
    where: { id, tenantId },
    select: { id: true, inquiryId: true, forwardedToUserId: true, tenantId: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'C/S를 찾을 수 없습니다.' });
    return;
  }

  await prisma.csReport.delete({ where: { id } });
  void notifyCsReportNavBadges(
    existing.inquiryId,
    existing.forwardedToUserId ? [existing.forwardedToUserId] : [],
    existing.tenantId,
  );
  res.json({ ok: true });
});

export default router;
