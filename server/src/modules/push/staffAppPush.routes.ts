import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { prisma } from '../../lib/prisma.js';
import { CBISEO_STAFF_APP_PACKAGE } from '../../lib/cbiseoStaffAppPolicy.constants.js';
import { isStaffAppFcmConfigured } from './staffAppPushNotify.js';

const router = Router();

router.use(authMiddleware, requireTenantAuth);

/** 앱 푸시 연동 상태 (FCM 서버 설정·본인 토큰 등록 여부) */
router.get('/staff-app/status', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const userId = auth.userId;
  const row = await prisma.staffAppFcmToken.findFirst({
    where: { tenantId, userId, appId: CBISEO_STAFF_APP_PACKAGE },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true, deviceLabel: true },
  });
  res.json({
    fcmServerConfigured: isStaffAppFcmConfigured(),
    hasRegisteredToken: Boolean(row),
    tokenUpdatedAt: row?.updatedAt?.toISOString() ?? null,
    deviceLabel: row?.deviceLabel ?? null,
  });
});

/** FCM 디바이스 토큰 등록·갱신 (청소비서 com.cbiseo.app) */
router.post('/staff-app/register', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const userId = auth.userId;
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token || token.length < 20) {
    res.status(400).json({ error: 'FCM 토큰이 필요합니다.' });
    return;
  }
  const appId =
    typeof req.body?.appId === 'string' && req.body.appId.trim()
      ? req.body.appId.trim()
      : CBISEO_STAFF_APP_PACKAGE;
  const deviceLabel =
    typeof req.body?.deviceLabel === 'string' ? req.body.deviceLabel.trim().slice(0, 128) : null;

  await prisma.staffAppFcmToken.upsert({
    where: { token },
    create: {
      tenantId,
      userId,
      token,
      appId,
      deviceLabel: deviceLabel || null,
    },
    update: {
      tenantId,
      userId,
      appId,
      deviceLabel: deviceLabel || null,
    },
  });

  res.json({ ok: true });
});

/** 로그아웃·토큰 무효화 */
router.delete('/staff-app/register', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const userId = auth.userId;
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (token) {
    await prisma.staffAppFcmToken.deleteMany({ where: { tenantId, userId, token } });
  } else {
    await prisma.staffAppFcmToken.deleteMany({ where: { tenantId, userId } });
  }
  res.json({ ok: true });
});

export default router;
