import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import {
  cancelLandingContactLinkSlotRequest,
  createLandingContactLinkSlotRequest,
  createLandingContactSourceLink,
  getLandingContactSourceLinkBoard,
  LandingContactSourceLinkError,
  updateLandingContactSourceLink,
} from './landingContactSourceLink.service.js';

const router = Router();

function tenantIdOf(req: { user?: AuthPayload } | object): string | null {
  return getTenantIdFromAuth((req as { user?: AuthPayload }).user);
}

function sendLinkError(res: { status: (n: number) => { json: (b: unknown) => void } }, e: unknown) {
  if (e instanceof LandingContactSourceLinkError) {
    res.status(e.statusCode).json({ error: e.message, code: e.code });
    return true;
  }
  return false;
}

router.get('/source-links', async (req, res) => {
  const tenantId = tenantIdOf(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const board = await getLandingContactSourceLinkBoard(tenantId);
  res.json(board);
});

router.post('/source-links', requireStaffPermission('leads.edit'), async (req, res) => {
  const tenantId = tenantIdOf(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as { label?: string; operatingCompanyId?: string | null; code?: string | null };
  try {
    const link = await createLandingContactSourceLink({
      tenantId,
      label: body.label ?? '',
      operatingCompanyId: body.operatingCompanyId,
      code: body.code,
    });
    res.status(201).json(link);
  } catch (e) {
    if (sendLinkError(res, e)) return;
    throw e;
  }
});

router.patch('/source-links/:linkId', requireStaffPermission('leads.edit'), async (req, res) => {
  const tenantId = tenantIdOf(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as { label?: string; operatingCompanyId?: string | null; isActive?: boolean };
  try {
    const link = await updateLandingContactSourceLink({
      tenantId,
      id: req.params.linkId,
      label: body.label,
      operatingCompanyId: body.operatingCompanyId,
      isActive: body.isActive,
    });
    res.json(link);
  } catch (e) {
    if (sendLinkError(res, e)) return;
    throw e;
  }
});

router.post('/source-link-requests', requireStaffPermission('leads.edit'), async (req, res) => {
  const tenantId = tenantIdOf(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const auth = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as { requestedCount?: number; message?: string | null };
  try {
    const row = await createLandingContactLinkSlotRequest({
      tenantId,
      requesterUserId: auth.userId ?? null,
      requestedCount: body.requestedCount ?? 1,
      message: body.message,
    });
    res.status(201).json(row);
  } catch (e) {
    if (sendLinkError(res, e)) return;
    throw e;
  }
});

router.post('/source-link-requests/:requestId/cancel', requireStaffPermission('leads.edit'), async (req, res) => {
  const tenantId = tenantIdOf(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const row = await cancelLandingContactLinkSlotRequest(tenantId, req.params.requestId);
    res.json(row);
  } catch (e) {
    if (sendLinkError(res, e)) return;
    throw e;
  }
});

export default router;
