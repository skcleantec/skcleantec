import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  getTenantNotificationPolicy,
  getUserNotificationPreferences,
  upsertUserNotificationPreferences,
} from './notificationPolicy.service.js';
import {
  mergeUserNotificationPreferences,
  buildTeamNotificationSettingsView,
} from '../../lib/notificationPolicy.helpers.js';
import { getEffectiveEnabledModules } from '../tenants/tenantFeatures.service.js';
import { isSoloOperatorTenant } from '../../lib/soloOperator.js';
import type { StaffAppPushKind } from '../../lib/staffAppPush.helpers.js';

type NotificationSettingItem = {
  kind: StaffAppPushKind;
  label: string;
  description: string;
  mandatory: boolean;
  push: boolean;
  canToggle: boolean;
};

/** 1인 사장 — 해피콜·일정 알림은 보여주고, 배정 알림은 숨긴다. */
function filterSoloAdminNotificationItems(items: NotificationSettingItem[]): NotificationSettingItem[] {
  return items
    .filter((item) => item.kind !== 'assignment')
    .map((item) => {
      if (item.kind === 'schedule_alert') {
        return { ...item, description: '일정·금액·취소가 바뀌면 사장 휴대폰으로 알립니다.' };
      }
      if (item.kind === 'happy_call') {
        return { ...item, description: '청소 전날부터 해피콜이 남아 있으면 사장 휴대폰으로 알립니다.' };
      }
      return item;
    });
}

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const { userId, role } = auth;
  if (role !== 'ADMIN' && role !== 'MARKETER') {
    res.status(403).json({ error: '관리·마케터 계정에서만 이용할 수 있습니다.' });
    return;
  }
  const [tenantPolicy, userPref, enabledModules] = await Promise.all([
    getTenantNotificationPolicy(tenantId),
    getUserNotificationPreferences(tenantId, userId),
    getEffectiveEnabledModules(tenantId),
  ]);
  const items = buildTeamNotificationSettingsView(tenantPolicy, userPref);
  res.json({
    items:
      role === 'ADMIN' && isSoloOperatorTenant(enabledModules)
        ? filterSoloAdminNotificationItems(items)
        : items,
  });
});

router.patch('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const { userId, role } = auth;
  if (role !== 'ADMIN' && role !== 'MARKETER') {
    res.status(403).json({ error: '관리·마케터 계정에서만 이용할 수 있습니다.' });
    return;
  }
  const body = req.body as { kinds?: unknown };
  const merged = mergeUserNotificationPreferences({ kinds: body.kinds });
  const saved = await upsertUserNotificationPreferences(tenantId, userId, merged);
  const [tenantPolicy, enabledModules] = await Promise.all([
    getTenantNotificationPolicy(tenantId),
    getEffectiveEnabledModules(tenantId),
  ]);
  const items = buildTeamNotificationSettingsView(tenantPolicy, saved);
  res.json({
    items:
      role === 'ADMIN' && isSoloOperatorTenant(enabledModules)
        ? filterSoloAdminNotificationItems(items)
        : items,
  });
});

export default router;
