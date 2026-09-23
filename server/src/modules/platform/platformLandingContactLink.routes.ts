import { Router } from 'express';
import type { LandingContactLinkRequestStatus } from '@prisma/client';
import { platformAuthMiddleware, platformSuperAdminOnly } from './platformAuth.middleware.js';
import {
  LandingContactSourceLinkError,
  listLandingContactLinkSlotRequestsForPlatform,
  reviewLandingContactLinkSlotRequest,
} from '../landing-contact/landingContactSourceLink.service.js';

const router = Router();
router.use(platformAuthMiddleware);

router.get('/', async (req, res) => {
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
  const status =
    statusRaw === 'PENDING' ||
    statusRaw === 'APPROVED' ||
    statusRaw === 'REJECTED' ||
    statusRaw === 'CANCELLED'
      ? (statusRaw as LandingContactLinkRequestStatus)
      : undefined;
  const items = await listLandingContactLinkSlotRequestsForPlatform(status);
  res.json({ items });
});

router.post('/:id/approve', platformSuperAdminOnly, async (req, res) => {
  const auth = req as unknown as { platformUser: { platformUserId: string } };
  const body = req.body as { adminNote?: string };
  try {
    const item = await reviewLandingContactLinkSlotRequest({
      requestId: req.params.id,
      platformUserId: auth.platformUser.platformUserId,
      approve: true,
      adminNote: body.adminNote,
    });
    res.json(item);
  } catch (e) {
    if (e instanceof LandingContactSourceLinkError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.post('/:id/reject', platformSuperAdminOnly, async (req, res) => {
  const auth = req as unknown as { platformUser: { platformUserId: string } };
  const body = req.body as { adminNote?: string };
  try {
    const item = await reviewLandingContactLinkSlotRequest({
      requestId: req.params.id,
      platformUserId: auth.platformUser.platformUserId,
      approve: false,
      adminNote: body.adminNote,
    });
    res.json(item);
  } catch (e) {
    if (e instanceof LandingContactSourceLinkError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    throw e;
  }
});

export default router;
