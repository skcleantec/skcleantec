import { Router } from 'express';
import multer from 'multer';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import {
  listCrewNoticeArchive,
  listNotices,
  listTeamNotices,
  markMessageAttachmentsViewed,
  noticeReaders,
  remindNotice,
  uploadMessageAttachments,
} from './messageAttachment.service.js';
import { normalizeAttachmentIds } from './messageAttachment.logic.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 35 },
});

function userOf(req: Express.Request): AuthPayload {
  return (req as Express.Request & { user: AuthPayload }).user;
}

function fail(res: { status: (code: number) => { json: (body: object) => void } }, error: unknown): void {
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: number }).status) : 500;
  const message = error instanceof Error ? error.message : '처리하지 못했습니다.';
  if (status === 429 && typeof error === 'object' && error && 'retryAfterMinutes' in error) {
    res.status(429).json({
      error: message,
      retryAfterMinutes: (error as { retryAfterMinutes: number }).retryAfterMinutes,
    });
    return;
  }
  res.status(status === 400 || status === 403 || status === 404 ? status : 500).json({
    error: status === 500 ? '처리하지 못했습니다.' : message,
  });
}

export function registerMessageAttachmentRoutes(router: Router): void {
  router.post('/attachments', (req, res, next) => {
    upload.array('files', 35)(req, res, (error: unknown) => {
      if (error) {
        res.status(400).json({ error: '사진은 한 장에 25MB까지, 한 번에 35개까지예요.' });
        return;
      }
      next();
    });
  }, async (req, res) => {
    const user = userOf(req);
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
      res.status(403).json({ error: '관리자·마케터만 파일을 올릴 수 있어요.' });
      return;
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      const attachments = await uploadMessageAttachments({
        tenantId,
        uploaderId: user.userId,
        files: files.map((file) => ({
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        })),
      });
      res.status(201).json({ attachments });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/attachments/viewed', async (req, res) => {
    const user = userOf(req);
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const messageId = typeof req.body?.messageId === 'string' ? req.body.messageId.trim() : '';
    if (!messageId) {
      res.status(400).json({ error: '메시지를 지정해 주세요.' });
      return;
    }
    try {
      await markMessageAttachmentsViewed(tenantId, user.userId, messageId);
      res.json({ ok: true });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/notices', async (req, res) => {
    const user = userOf(req);
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
      res.status(403).json({ error: '관리자·마케터만 공지를 볼 수 있어요.' });
      return;
    }
    const filterRaw = typeof req.query.filter === 'string' ? req.query.filter : 'all';
    if (filterRaw !== 'all' && filterRaw !== 'image' && filterRaw !== 'file') {
      res.status(400).json({ error: '필터는 all, image, file 중 하나예요.' });
      return;
    }
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '';
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null;
    try {
      res.json(await listNotices({ tenantId, filter: filterRaw, q, cursor }));
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/notices/:batchId/readers', async (req, res) => {
    const user = userOf(req);
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
      res.status(403).json({ error: '관리자·마케터만 볼 수 있어요.' });
      return;
    }
    const data = await noticeReaders(tenantId, req.params.batchId);
    if (!data) {
      res.status(404).json({ error: '공지를 찾을 수 없습니다.' });
      return;
    }
    res.json(data);
  });

  router.post('/notices/:batchId/remind', async (req, res) => {
    const user = userOf(req);
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
      res.status(403).json({ error: '관리자·마케터만 다시 알릴 수 있어요.' });
      return;
    }
    try {
      const result = await remindNotice(tenantId, req.params.batchId, user.userId, user.role);
      res.json(result);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/team-notices', async (req, res) => {
    const user = userOf(req);
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    if (user.role !== 'TEAM_LEADER' && user.role !== 'EXTERNAL_PARTNER') {
      res.status(403).json({ error: '팀장·타업체만 볼 수 있어요.' });
      return;
    }
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null;
    res.json(await listTeamNotices(tenantId, user.userId, cursor));
  });
}

export function readAttachmentIds(body: { attachmentIds?: unknown }): string[] | null {
  return normalizeAttachmentIds(body.attachmentIds);
}

export { listCrewNoticeArchive };
