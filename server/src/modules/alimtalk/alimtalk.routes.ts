import { Router, type Response } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { ALIMTALK_MODULE_ID } from '../../lib/alimtalkPolicy.js';
import { getTenantAlimtalkStatus } from './alimtalkSend.service.js';
import {
  getAlimtalkSettingsForTenantAdmin,
  requestAlimtalkTopUpForTenantAdmin,
  saveAlimtalkTemplatesForTenantAdmin,
} from './alimtalkTenantSettings.service.js';

const router = Router();

router.use(authMiddleware, requireTenantAuth, requireFeature(ALIMTALK_MODULE_ID));

function requireTenantAdmin(res: Response, user: AuthPayload): boolean {
  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 이용할 수 있습니다.' });
    return false;
  }
  return true;
}

router.get('/status', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const status = await getTenantAlimtalkStatus(tenantId);
  if (!status) {
    res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    return;
  }
  res.json(status);
});

router.get('/settings', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    const settings = await getAlimtalkSettingsForTenantAdmin(tenantId);
    res.json(settings);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알림톡 설정 조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.patch('/settings', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = req.body as { templates?: { code: string; enabled: boolean }[] };
  if (!Array.isArray(body.templates)) {
    res.status(400).json({ error: 'templates 배열이 필요합니다.' });
    return;
  }
  try {
    const settings = await saveAlimtalkTemplatesForTenantAdmin(tenantId, body.templates);
    res.json(settings);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알림톡 설정 저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/charge-requests', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!requireTenantAdmin(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = req.body as { amountKrw?: number; memo?: string };
  const amountKrw = Number(body.amountKrw);
  if (!Number.isFinite(amountKrw)) {
    res.status(400).json({ error: '충전 금액이 올바르지 않습니다.' });
    return;
  }
  try {
    const settings = await requestAlimtalkTopUpForTenantAdmin(tenantId, user.userId, {
      amountKrw,
      memo: body.memo,
    });
    res.json(settings);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '충전 신청에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
