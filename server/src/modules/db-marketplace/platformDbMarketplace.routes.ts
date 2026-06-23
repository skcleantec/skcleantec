import { Router } from 'express';
import { platformAuthMiddleware, platformSuperAdminOnly } from '../platform/platformAuth.middleware.js';
import {
  listDbMarketplaceForPlatform,
  platformResumeDbListing,
  platformSuspendDbListing,
  PlatformDbMarketplaceError,
} from './platformDbMarketplace.service.js';
import { expireStaleOpenDbListings } from './dbMarketplaceExpire.service.js';

const router = Router();

router.use(platformAuthMiddleware);

function mapError(res: import('express').Response, e: unknown): boolean {
  if (e instanceof PlatformDbMarketplaceError) {
    res.status(e.status).json({ error: e.message });
    return true;
  }
  return false;
}

/** 플랫폼 — 정보공유 listing 메타 (고객 PII 없음) */
router.get('/', platformSuperAdminOnly, async (req, res) => {
  await expireStaleOpenDbListings();
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId.trim() : undefined;
  const items = await listDbMarketplaceForPlatform({ tenantId });
  res.json({ items });
});

router.post('/:id/suspend', platformSuperAdminOnly, async (req, res) => {
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!listingId) {
    res.status(400).json({ error: 'listing id가 필요합니다.' });
    return;
  }
  try {
    await platformSuspendDbListing(listingId);
    res.json({ ok: true });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/resume', platformSuperAdminOnly, async (req, res) => {
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!listingId) {
    res.status(400).json({ error: 'listing id가 필요합니다.' });
    return;
  }
  try {
    await platformResumeDbListing(listingId);
    res.json({ ok: true });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

export default router;
