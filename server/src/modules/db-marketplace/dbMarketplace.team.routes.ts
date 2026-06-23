import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  DbMarketplaceError,
  getDbMarketplaceListingById,
  listDbMarketplaceListings,
  serializeSellerListing,
} from './dbMarketplace.service.js';
import { confirmDbListingBuyer } from './dbMarketplaceConfirm.service.js';

const router = Router();

router.use(requireFeature('mod_db_marketplace'));

function mapError(res: import('express').Response, e: unknown): boolean {
  if (e instanceof DbMarketplaceError) {
    res.status(e.status).json({ error: e.message });
    return true;
  }
  return false;
}

/** 타업체 — 구매 가능 목록 (자사 테넌트 마켓) */
router.get('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  if (auth.role !== 'EXTERNAL_PARTNER') {
    res.status(403).json({ error: '타업체 계정만 이용할 수 있습니다.' });
    return;
  }
  const me = await prisma.user.findFirst({
    where: { id: auth.userId, tenantId },
    select: { externalCompanyId: true },
  });
  if (!me?.externalCompanyId) {
    res.status(403).json({ error: '타업체 소속 정보가 없습니다.' });
    return;
  }
  const result = await listDbMarketplaceListings(
    tenantId,
    'available',
    req.query.limit,
    req.query.offset,
    { viewerExternalCompanyId: me.externalCompanyId },
  );
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  if (auth.role !== 'EXTERNAL_PARTNER') {
    res.status(403).json({ error: '타업체 계정만 이용할 수 있습니다.' });
    return;
  }
  const me = await prisma.user.findFirst({
    where: { id: auth.userId, tenantId },
    select: { externalCompanyId: true },
  });
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const item = await getDbMarketplaceListingById(tenantId, listingId, {
      viewerExternalCompanyId: me?.externalCompanyId,
    });
    res.json({ item });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/buyer-confirm', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  if (auth.role !== 'EXTERNAL_PARTNER') {
    res.status(403).json({ error: '타업체 계정만 이용할 수 있습니다.' });
    return;
  }
  const me = await prisma.user.findFirst({
    where: { id: auth.userId, tenantId },
    select: { externalCompanyId: true },
  });
  if (!me?.externalCompanyId) {
    res.status(403).json({ error: '타업체 소속 정보가 없습니다.' });
    return;
  }
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const listing = await confirmDbListingBuyer(listingId, {
      kind: 'EXTERNAL_COMPANY',
      tenantId,
      userId: auth.userId,
      externalCompanyId: me.externalCompanyId,
    });
    res.json({ listing: serializeSellerListing(listing) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

export default router;
