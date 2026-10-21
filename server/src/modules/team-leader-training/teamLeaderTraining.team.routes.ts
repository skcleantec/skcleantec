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

  const meta = await getTeamLeaderTrainingMeta(tenantId);
  res.json(meta);
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
