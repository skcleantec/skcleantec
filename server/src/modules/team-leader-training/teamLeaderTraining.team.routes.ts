import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  fetchTeamLeaderTrainingPdf,
  getTeamLeaderTrainingMeta,
  TEAM_LEADER_TRAINING_PDF_FILENAME,
} from './teamLeaderTraining.service.js';

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

  try {
    const meta = await getTeamLeaderTrainingMeta(tenantId);
    res.json(meta);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'forbidden') {
      res.json({ available: false, fileName: null, updatedAt: null });
      return;
    }
    throw e;
  }
});

/** GET /api/team/training-material/pdf — 인증 프록시 (Cloudinary URL 비노출) */
router.get('/pdf', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  if (!isTeamLeaderRole(auth.role)) {
    res.status(403).json({ error: '팀장만 열람할 수 있습니다.' });
    return;
  }

  try {
    const { buffer, updatedAt } = await fetchTeamLeaderTrainingPdf({ tenantId });
    const encoded = encodeURIComponent(TEAM_LEADER_TRAINING_PDF_FILENAME)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encoded}`);
    if (updatedAt) res.setHeader('X-Training-Updated-At', updatedAt);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'not_found') {
      res.status(404).json({ error: err.message ?? '등록된 교육자료가 없습니다.' });
      return;
    }
    if (err.code === 'forbidden') {
      res.status(403).json({ error: err.message ?? 'SK클린텍 전용 기능입니다.' });
      return;
    }
    if (err.code === 'upstream') {
      res.status(502).json({ error: err.message ?? '교육자료 파일을 불러올 수 없습니다.' });
      return;
    }
    console.error('[team-leader-training] pdf proxy failed', e);
    res.status(500).json({ error: '교육자료를 불러올 수 없습니다.' });
  }
});

export default router;
