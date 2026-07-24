import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import type { DbMarketplaceListTab } from './dbMarketplace.service.js';
import {
  DbMarketplaceError,
  getDbMarketplaceListingById,
  listDbMarketplaceListings,
  serializeSellerListing,
} from './dbMarketplace.service.js';
import { confirmDbListingBuyer, declineDbListingBuyer } from './dbMarketplaceConfirm.service.js';
import { bulkConfirmDbListingBuyer, bulkDeclineDbListingBuyer } from './dbMarketplaceBulk.service.js';
import {
  listDbListingMessages,
  postDbListingMessage,
} from './dbMarketplaceMessages.service.js';

const router = Router();

router.use(requireFeature('mod_db_marketplace'));

function mapError(res: import('express').Response, e: unknown): boolean {
  if (e instanceof DbMarketplaceError) {
    res.status(e.status).json({ error: e.message });
    return true;
  }
  return false;
}

function parseExternalTab(raw: unknown): DbMarketplaceListTab {
  if (raw === 'pending' || raw === 'confirmed') return raw;
  return 'available';
}

async function requireExternalPartner(auth: AuthPayload, tenantId: string) {
  if (auth.role !== 'EXTERNAL_PARTNER') {
    return { error: '타업체 계정만 이용할 수 있습니다.', status: 403 as const, me: null };
  }
  const me = await prisma.user.findFirst({
    where: { id: auth.userId, tenantId },
    select: { externalCompanyId: true },
  });
  if (!me?.externalCompanyId) {
    return { error: '타업체 소속 정보가 없습니다.', status: 403 as const, me: null };
  }
  return { error: null, status: 200 as const, me };
}

/** 타업체 — 정보공유 목록 (자사 테넌트 마켓) */
router.get('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const ext = await requireExternalPartner(auth, tenantId);
  if (ext.error) {
    res.status(ext.status).json({ error: ext.error });
    return;
  }

  const tab = parseExternalTab(req.query.tab);
  const result = await listDbMarketplaceListings(
    tenantId,
    tab,
    req.query.limit,
    req.query.offset,
    { viewerExternalCompanyId: ext.me!.externalCompanyId },
  );
  res.json(result);
});

router.post('/bulk/buyer-confirm', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const ext = await requireExternalPartner(auth, tenantId);
  if (ext.error) {
    res.status(ext.status).json({ error: ext.error });
    return;
  }

  const body = req.body as { listingIds?: unknown };
  try {
    const result = await bulkConfirmDbListingBuyer(body.listingIds, {
      kind: 'EXTERNAL_COMPANY',
      tenantId,
      userId: auth.userId,
      externalCompanyId: ext.me!.externalCompanyId!,
    });
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/bulk/buyer-decline', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const ext = await requireExternalPartner(auth, tenantId);
  if (ext.error) {
    res.status(ext.status).json({ error: ext.error });
    return;
  }

  const body = req.body as { listingIds?: unknown };
  try {
    const result = await bulkDeclineDbListingBuyer(body.listingIds, {
      kind: 'EXTERNAL_COMPANY',
      tenantId,
      userId: auth.userId,
      externalCompanyId: ext.me!.externalCompanyId!,
    });
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.get('/:id', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const ext = await requireExternalPartner(auth, tenantId);
  if (ext.error) {
    res.status(ext.status).json({ error: ext.error });
    return;
  }

  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const item = await getDbMarketplaceListingById(tenantId, listingId, {
      viewerExternalCompanyId: ext.me!.externalCompanyId,
    });
    res.json({ item });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.get('/:id/messages', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const ext = await requireExternalPartner(auth, tenantId);
  if (ext.error) {
    res.status(ext.status).json({ error: ext.error });
    return;
  }

  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const result = await listDbListingMessages(
      {
        kind: 'EXTERNAL',
        tenantId,
        userId: auth.userId,
        externalCompanyId: ext.me!.externalCompanyId!,
      },
      listingId,
    );
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/messages', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const ext = await requireExternalPartner(auth, tenantId);
  if (ext.error) {
    res.status(ext.status).json({ error: ext.error });
    return;
  }

  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  const body = (req.body as { body?: unknown })?.body;
  try {
    const item = await postDbListingMessage(
      {
        kind: 'EXTERNAL',
        tenantId,
        userId: auth.userId,
        externalCompanyId: ext.me!.externalCompanyId!,
      },
      listingId,
      body,
    );
    res.json({ item });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/hold', (_req, res) => {
  res.status(410).json({ error: '검토 예약(hold) 기능은 종료되었습니다. 구매신청으로 진행해 주세요.' });
});

router.delete('/:id/hold', (_req, res) => {
  res.status(410).json({ error: '검토 예약(hold) 기능은 종료되었습니다.' });
});

router.post('/:id/buyer-confirm', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const ext = await requireExternalPartner(auth, tenantId);
  if (ext.error) {
    res.status(ext.status).json({ error: ext.error });
    return;
  }

  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const listing = await confirmDbListingBuyer(listingId, {
      kind: 'EXTERNAL_COMPANY',
      tenantId,
      userId: auth.userId,
      externalCompanyId: ext.me!.externalCompanyId!,
    });
    res.json({ listing: serializeSellerListing(listing) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/buyer-decline', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const ext = await requireExternalPartner(auth, tenantId);
  if (ext.error) {
    res.status(ext.status).json({ error: ext.error });
    return;
  }

  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const listing = await declineDbListingBuyer(listingId, {
      kind: 'EXTERNAL_COMPANY',
      tenantId,
      userId: auth.userId,
      externalCompanyId: ext.me!.externalCompanyId!,
    });
    res.json({ listing: serializeSellerListing(listing) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

export default router;
