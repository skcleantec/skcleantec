import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermissionByMethod, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { prisma } from '../../lib/prisma.js';
import {
  countDbListingDrafts,
  countDbListingOpen,
  countDbListingPendingSeller,
  countDbListingPendingBuyer,
  DbMarketplaceError,
  getDbListingForInquiry,
  getDbMarketplaceListingById,
  listDbMarketplaceAudienceOptions,
  listDbMarketplaceListings,
  publishDbListing,
  serializeSellerListing,
  updateDbListingAudience,
  removeDbListingFromCart,
  revertDbListingToCart,
  upsertDbListingDraft,
  withdrawDbListing,
} from './dbMarketplace.service.js';
import { parseDbMarketplaceListFilters } from './dbMarketplaceListFilters.js';
import {
  confirmDbListingBuyer,
  confirmDbListingSeller,
  declineDbListingSeller,
} from './dbMarketplaceConfirm.service.js';
import {
  listDbListingMessages,
  postDbListingMessage,
} from './dbMarketplaceMessages.service.js';
import {
  notifyDbMarketplaceBroadcast,
  notifyDbMarketplaceSellerAdmins,
} from './dbMarketplaceNotify.service.js';
import { notifyDbMarketplacePriorityRank } from './dbMarketplacePriorityNotify.service.js';
import {
  bulkConfirmDbListingBuyer,
  bulkConfirmDbListingSeller,
  bulkDeclineDbListingSeller,
  bulkPublishDbListings,
  bulkRemoveDbListingsFromCart,
  bulkRevertDbListingsToCart,
  bulkWithdrawDbListings,
} from './dbMarketplaceBulk.service.js';
import { completeRecallDbListing } from './dbMarketplaceCompleteRecall.service.js';
import { stepRecallDbListing } from './dbMarketplaceStepRecall.service.js';
import { listDbMarketplaceEvents } from './dbMarketplaceHistory.service.js';

const router = Router();

router.use(authMiddleware, staffMarketerRoleOnly, requireFeature('mod_db_marketplace'));
router.use(requireStaffPermissionByMethod(['marketplace.view'], ['marketplace.trade']));

function mapError(res: import('express').Response, e: unknown): boolean {
  if (e instanceof DbMarketplaceError) {
    res.status(e.status).json({ error: e.message });
    return true;
  }
  return false;
}

router.get('/audience-options', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const options = await listDbMarketplaceAudienceOptions(tenantId);
  res.json(options);
});

router.get('/draft-count', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const [count, sellerPendingCount, buyerPendingCount, openCount] = await Promise.all([
    countDbListingDrafts(tenantId),
    countDbListingPendingSeller(tenantId),
    countDbListingPendingBuyer(tenantId),
    countDbListingOpen(tenantId),
  ]);
  res.json({ count, sellerPendingCount, buyerPendingCount, openCount });
});

router.get('/by-inquiry/:inquiryId', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const inquiryId = typeof req.params.inquiryId === 'string' ? req.params.inquiryId : '';
  const row = await getDbListingForInquiry(tenantId, inquiryId);
  res.json({ listing: row ? serializeSellerListing(row) : null });
});

router.post('/draft', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { inquiryId?: unknown; listingFee?: unknown };
  const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId.trim() : '';
  if (!inquiryId) {
    res.status(400).json({ error: '접수를 선택해 주세요.' });
    return;
  }
  try {
    const row = await upsertDbListingDraft(tenantId, inquiryId, body.listingFee);
    await notifyDbMarketplaceSellerAdmins(tenantId);
    res.json({ listing: serializeSellerListing(row) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/bulk/publish', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as {
    listingIds?: unknown;
    visibility?: unknown;
    audiences?: unknown;
    offerMode?: unknown;
  };
  try {
    const result = await bulkPublishDbListings(
      tenantId,
      body.listingIds,
      body.visibility,
      body.audiences,
      body.offerMode,
    );
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/bulk/buyer-confirm', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const body = req.body as { listingIds?: unknown };
  try {
    const result = await bulkConfirmDbListingBuyer(body.listingIds, {
      kind: 'PARTNER_TENANT',
      tenantId,
      userId: auth.userId,
    });
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/bulk/withdraw', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { listingIds?: unknown };
  try {
    const result = await bulkWithdrawDbListings(tenantId, body.listingIds);
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/bulk/revert-to-cart', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { listingIds?: unknown };
  try {
    const result = await bulkRevertDbListingsToCart(tenantId, body.listingIds);
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/bulk/remove-from-cart', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { listingIds?: unknown };
  try {
    const result = await bulkRemoveDbListingsFromCart(tenantId, body.listingIds);
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/bulk/seller-confirm', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const body = req.body as { listingIds?: unknown };
  try {
    const result = await bulkConfirmDbListingSeller(tenantId, auth.userId, body.listingIds);
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/bulk/seller-decline', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const body = req.body as { listingIds?: unknown };
  try {
    const result = await bulkDeclineDbListingSeller(tenantId, auth.userId, body.listingIds);
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.patch('/:id/audience', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  const body = req.body as { visibility?: unknown; audiences?: unknown; offerMode?: unknown };
  try {
    const row = await updateDbListingAudience(
      tenantId,
      listingId,
      body.visibility,
      body.audiences,
      body.offerMode,
    );
    if (row.status === 'OPEN') {
      if (row.offerMode === 'PRIORITY' && row.currentPriorityRank) {
        await notifyDbMarketplacePriorityRank({
          sellerTenantId: tenantId,
          audiences: row.audiences,
          rank: row.currentPriorityRank,
        });
      } else {
        await notifyDbMarketplaceBroadcast({
          sellerTenantId: tenantId,
          visibility: row.visibility,
          audiences: row.audiences,
        });
      }
    } else {
      await notifyDbMarketplaceSellerAdmins(tenantId);
    }
    res.json({ listing: serializeSellerListing(row) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/publish', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const row = await publishDbListing(tenantId, listingId);
    if (row.offerMode !== 'PRIORITY') {
      await notifyDbMarketplaceBroadcast({
        sellerTenantId: tenantId,
        visibility: row.visibility,
        audiences: row.audiences,
      });
    }
    res.json({ listing: serializeSellerListing(row) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/withdraw', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const row = await withdrawDbListing(tenantId, listingId);
    await notifyDbMarketplaceBroadcast({
      sellerTenantId: tenantId,
      visibility: row.visibility,
      audiences: row.audiences,
    });
    res.json({ listing: serializeSellerListing(row) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/revert-to-cart', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const row = await revertDbListingToCart(tenantId, listingId);
    await notifyDbMarketplaceBroadcast({
      sellerTenantId: tenantId,
      visibility: row.visibility,
      audiences: row.audiences,
    });
    await notifyDbMarketplaceSellerAdmins(tenantId);
    res.json({ listing: serializeSellerListing(row) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/seller-complete-recall', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  const body = req.body as { password?: unknown };
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password.trim()) {
    res.status(400).json({ error: '비밀번호를 입력해 주세요.' });
    return;
  }
  try {
    const result = await completeRecallDbListing({
      sellerTenantId: tenantId,
      sellerUserId: auth.userId,
      listingId,
      password,
    });
    await notifyDbMarketplaceSellerAdmins(tenantId);
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/seller-cart-recall', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  const body = req.body as { password?: unknown };
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password.trim()) {
    res.status(400).json({ error: '비밀번호를 입력해 주세요.' });
    return;
  }
  try {
    const result = await stepRecallDbListing({
      sellerTenantId: tenantId,
      sellerUserId: auth.userId,
      listingId,
      password,
      mode: 'cart',
    });
    await notifyDbMarketplaceSellerAdmins(tenantId);
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.get('/:id/history', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId, tenantId },
    select: { id: true },
  });
  if (!listing) {
    res.status(404).json({ error: '판매 항목을 찾을 수 없습니다.' });
    return;
  }
  const events = await listDbMarketplaceEvents(listingId);
  res.json({
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      hopIndex: e.hopIndex,
      createdAt: e.createdAt.toISOString(),
      actorName: e.actor?.name ?? e.actor?.email ?? null,
      payload: e.payload,
    })),
  });
});

router.post('/:id/remove-from-cart', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const row = await removeDbListingFromCart(tenantId, listingId);
    await notifyDbMarketplaceSellerAdmins(tenantId);
    res.json(row);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/buyer-confirm', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const peek = await prisma.inquiryDbListing.findFirst({
      where: { id: listingId },
      select: { tenantId: true },
    });
    if (peek?.tenantId === tenantId) {
      res.status(400).json({ error: '자사 DB는 이 경로로 구매할 수 없습니다.' });
      return;
    }
    const listing = await confirmDbListingBuyer(listingId, {
      kind: 'PARTNER_TENANT',
      tenantId,
      userId: auth.userId,
    });
    res.json({ listing: serializeSellerListing(listing) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/seller-decline', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const listing = await declineDbListingSeller(tenantId, auth.userId, listingId);
    res.json({ listing: serializeSellerListing(listing) });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/seller-confirm', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const result = await confirmDbListingSeller(tenantId, auth.userId, listingId);
    res.json({
      listing: serializeSellerListing(result.listing),
      targetInquiryId: result.targetInquiryId,
    });
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

router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const result = await listDbMarketplaceListings(
    tenantId,
    req.query.tab,
    req.query.limit,
    req.query.offset,
    { filters: parseDbMarketplaceListFilters(req.query as Record<string, unknown>) },
  );
  res.json(result);
});

router.get('/:id/messages', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const result = await listDbListingMessages(
      { kind: 'STAFF', tenantId, userId: auth.userId },
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
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  const body = (req.body as { body?: unknown })?.body;
  try {
    const item = await postDbListingMessage(
      { kind: 'STAFF', tenantId, userId: auth.userId },
      listingId,
      body,
    );
    res.json({ item });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.get('/:id', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const listingId = typeof req.params.id === 'string' ? req.params.id : '';
  try {
    const item = await getDbMarketplaceListingById(tenantId, listingId);
    res.json({ item });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

export default router;
