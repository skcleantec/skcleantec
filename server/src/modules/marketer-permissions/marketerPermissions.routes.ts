import { Router } from 'express';
import { authMiddleware, adminRoleOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { prisma } from '../../lib/prisma.js';
import { MARKETER_PERMISSION_GROUPS } from '../../lib/marketerPermissions.js';
import {
  buildMarketerPermissionsResponse,
  parseMarketerAdminLevelBody,
  parseMarketerPermissionsBody,
} from './marketerPermissions.service.js';

const router = Router();

router.use(authMiddleware);
router.use(adminRoleOnly);

/** 권한 카탈로그 — UI 체크리스트 */
router.get('/catalog', async (_req, res) => {
  res.json({ groups: MARKETER_PERMISSION_GROUPS });
});

/** 활성·퇴사 포함 마케터 목록(권한 설정용) */
router.get('/users', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const users = await prisma.user.findMany({
    where: {
      tenantId,
      role: 'MARKETER',
      platformSupportAccessId: null,
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      marketerAdminLevel: true,
      marketerPermissions: true,
    },
  });

  res.json({
    items: users.map((u) => buildMarketerPermissionsResponse(u)),
  });
});

/** 마케터 1명 권한 조회 */
router.get('/users/:userId', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const user = await prisma.user.findFirst({
    where: { id: req.params.userId, tenantId, role: 'MARKETER' },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      marketerAdminLevel: true,
      marketerPermissions: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: '마케터를 찾을 수 없습니다.' });
    return;
  }
  res.json(buildMarketerPermissionsResponse(user));
});

/** 마케터 권한 저장 — 프리셋 라디오 + 전체 권한 맵 */
router.patch('/users/:userId', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;

  const body = req.body as {
    marketerAdminLevel?: unknown;
    permissions?: unknown;
  };

  const level = parseMarketerAdminLevelBody(body.marketerAdminLevel);
  if (!level) {
    res.status(400).json({ error: 'marketerAdminLevel은 NONE, LIMITED, FULL 중 하나여야 합니다.' });
    return;
  }

  const permissions = parseMarketerPermissionsBody(body.permissions);
  if (!permissions) {
    res.status(400).json({ error: 'permissions 객체(전체 권한 맵)가 필요합니다.' });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { id: req.params.userId, tenantId, role: 'MARKETER' },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: '마케터를 찾을 수 없습니다.' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      marketerAdminLevel: level,
      marketerPermissions: permissions,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      marketerAdminLevel: true,
      marketerPermissions: true,
    },
  });

  res.json(buildMarketerPermissionsResponse(updated));
});

export default router;
