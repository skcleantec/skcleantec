import { Router } from 'express';
import { platformAuthMiddleware, platformSuperAdminOnly } from './platformAuth.middleware.js';
import {
  listTenantPartnershipsForPlatform,
  platformResumeTenantPartnership,
  platformSuspendTenantPartnership,
  PlatformTenantPartnershipError,
} from './platformTenantPartnerships.service.js';

const router = Router();

router.use(platformAuthMiddleware);

function mapError(res: import('express').Response, e: unknown): boolean {
  if (e instanceof PlatformTenantPartnershipError) {
    res.status(e.status).json({ error: e.message });
    return true;
  }
  return false;
}

/** 파트너십·share 메타 목록 (고객 PII 없음) */
router.get('/', async (_req, res) => {
  const items = await listTenantPartnershipsForPlatform();
  res.json({ items });
});

/** 플랫폼 강제 중지 — partnership SUSPENDED + share sync PAUSED */
router.post('/:id/suspend', platformSuperAdminOnly, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!id) {
    res.status(400).json({ error: '파트너십 id가 필요합니다.' });
    return;
  }
  try {
    await platformSuspendTenantPartnership(id);
    res.json({ ok: true });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 플랫폼 중지 해제 — ACTIVE 복구 + share sync ACTIVE */
router.post('/:id/resume', platformSuperAdminOnly, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!id) {
    res.status(400).json({ error: '파트너십 id가 필요합니다.' });
    return;
  }
  try {
    await platformResumeTenantPartnership(id);
    res.json({ ok: true });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

export default router;
