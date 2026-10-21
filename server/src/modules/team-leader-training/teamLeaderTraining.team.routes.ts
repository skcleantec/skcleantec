import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { getTeamLeaderTrainingMeta } from './teamLeaderTraining.service.js';
import {
  sendTeamLeaderTrainingPdf,
  sendTeamLeaderTrainingPdfError,
} from './teamLeaderTraining.pdfHttp.js';
import { signTeamLeaderTrainingFileTicket } from './teamLeaderTraining.ticket.js';
import {
  isSkTeamTrainingTenant,
  listSkTeamTrainingImages,
  skTeamTrainingImageFile,
  skTeamTrainingImageMeta,
} from './skTeamLeaderTrainingImages.js';

const router = Router();

router.use(teamAuthMiddleware);

function isTeamLeaderRole(role: string | undefined): boolean {
  return role === UserRole.TEAM_LEADER;
}

/** GET /api/team/training-material/meta */
router.get('/meta', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  // teamAuthMiddleware가 프리뷰 시 auth.role을 대상 팀장으로 매핑함 — viewer.role(ADMIN)은 쓰지 않음
  if (!isTeamLeaderRole(auth.role)) {
    res.status(403).json({ error: '팀장만 열람할 수 있습니다.' });
    return;
  }

  const images = await skTeamTrainingImageMeta(tenantId);
  if (images) {
    res.json(images);
    return;
  }

  const meta = await getTeamLeaderTrainingMeta(tenantId);
  res.json({ ...meta, kind: meta.available ? 'pdf' : null });
});

/** GET /api/team/training-material/images — SK클린텍 팀장 전용 장 목록 */
router.get('/images', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  if (!isTeamLeaderRole(auth.role) || !(await isSkTeamTrainingTenant(tenantId))) {
    res.status(404).json({ error: '등록된 교육자료가 없습니다.' });
    return;
  }

  const items = listSkTeamTrainingImages().map(({ index, title }) => ({ index, title }));
  if (items.length === 0) {
    res.status(404).json({ error: '등록된 교육자료가 없습니다.' });
    return;
  }
  res.json({ count: items.length, items });
});

/** GET /api/team/training-material/images/:index — 한 장. 인증된 SK 팀장만 */
router.get('/images/:index', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const index = Number(req.params.index);
  if (!isTeamLeaderRole(auth.role) || !Number.isInteger(index)) {
    res.status(404).json({ error: '교육자료 장을 찾을 수 없습니다.' });
    return;
  }

  const file = await skTeamTrainingImageFile(tenantId, index);
  if (!file) {
    res.status(404).json({ error: '교육자료 장을 찾을 수 없습니다.' });
    return;
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(file.filePath);
});

/** GET /api/team/training-material/file-links — 열기·저장용 짧은 주소 */
router.get('/file-links', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  if (!isTeamLeaderRole(auth.role)) {
    res.status(403).json({ error: '팀장만 열람할 수 있습니다.' });
    return;
  }

  const meta = await getTeamLeaderTrainingMeta(tenantId);
  if (!meta.available) {
    res.status(404).json({ error: '등록된 교육자료가 없습니다.' });
    return;
  }

  res.json({
    openPath: `/api/public/team-training-file/${signTeamLeaderTrainingFileTicket(tenantId, false)}`,
    downloadPath: `/api/public/team-training-file/${signTeamLeaderTrainingFileTicket(tenantId, true)}`,
  });
});

/** GET /api/team/training-material/pdf — 인증 프록시 (저장소 주소 비노출) */
router.get('/pdf', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  if (!isTeamLeaderRole(auth.role)) {
    res.status(403).json({ error: '팀장만 열람할 수 있습니다.' });
    return;
  }

  try {
    await sendTeamLeaderTrainingPdf(res, tenantId, false);
  } catch (e) {
    if (res.headersSent) return;
    sendTeamLeaderTrainingPdfError(res, e);
  }
});

export default router;
