import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireTelecrmTenant, requireTelecrmTenantAsync } from './telecrm.helpers.js';
import {
  createTelecrmCallSession,
  getTelecrmCallSessionSummary,
  getTelecrmCallSessionTeamSummary,
  listTelecrmCallSessions,
  parseCreateTelecrmCallSessionBody,
  parseSyncTelecrmCallSessionBody,
  serializeCallSessionRow,
  syncTelecrmCallSession,
} from './telecrmCallSession.service.js';
import { TELECRM_CONNECTED_MIN_SEC } from './telecrmCallSession.constants.js';
import { getTelecrmAppManifest, getTelecrmAppMinVersionName } from './telecrmAppManifest.js';
import {
  countTelecrmMobileDispatchPending,
  drainTelecrmMobileDispatchQueue,
  enqueueTelecrmMobileDispatch,
  parseTelecrmMobileDispatchBody,
} from './telecrmMobileDispatch.service.js';
import { countTelecrmAppsInTenant } from '../realtime/realtimeHub.js';
import { resolveTelecrmOrderFormLink } from './telecrmOrderLink.service.js';
import { getTelecrmWorkdeskStats } from './telecrmWorkdeskStats.service.js';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';
import type { TelecrmCallSessionStatus } from './telecrmCallSession.constants.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

/** Android 내부 앱 — 기능 플래그·최소 버전 (Play 심사 전 사무실 sideload용) */
router.get('/mobile-config', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const host = req.get('host') ?? '';
  const origin = `${req.protocol}://${host}`;
  const railwayEnv = (process.env.RAILWAY_ENVIRONMENT ?? '').trim().toLowerCase();
  const serverLabel =
    railwayEnv === 'staging' || host.includes('staging') || host.includes('railway.app')
      ? 'staging'
      : 'production';
  const appManifest = getTelecrmAppManifest();
  res.json({
    minAppVersion: getTelecrmAppMinVersionName(),
    minVersionCode: appManifest.minVersionCode,
    latestVersionCode: appManifest.latestVersionCode,
    latestVersionName: appManifest.latestVersionName,
    distribution: 'internal',
    serverOrigin: origin,
    serverLabel,
    features: {
      callSessions: true,
      smsDispatch: true,
      callRecording: false,
      pushNotifications: false,
      connectedMinSec: TELECRM_CONNECTED_MIN_SEC,
    },
  });
});

/** PC CRM → 동일 마케터 휴대폰 앱 (통화·문자 큐) */
router.post('/mobile-dispatch', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = await requireTelecrmTenantAsync(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const parsed = parseTelecrmMobileDispatchBody(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { item, wsDelivered, queued, broadcastToTenant, telecrmAppsConnected } =
    await enqueueTelecrmMobileDispatch(
    tenantId,
    user.userId,
    user.role ?? 'MARKETER',
    parsed,
  );
  res.status(201).json({
    ok: true,
    id: item.id,
    action: item.action,
    wsDelivered,
    queued,
    broadcastToTenant,
    telecrmAppsConnected,
  });
});

/** 앱 재개·WS 누락·ADMIN PC 통화 시 대기 중 dispatch 소비 */
router.get('/mobile-dispatch/pending', async (req, res) => {
  const tenantId = await requireTelecrmTenantAsync(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const items = await drainTelecrmMobileDispatchQueue(tenantId, user.userId, user.role ?? 'MARKETER');
  res.json({ items });
});

/** 연결 진단 — PC CRM·앱 서버 일치 확인용 */
router.get('/mobile-dispatch/status', async (req, res) => {
  const tenantId = await requireTelecrmTenantAsync(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const pendingCount = await countTelecrmMobileDispatchPending(
    tenantId,
    user.userId,
    user.role ?? 'MARKETER',
  );
  const host = req.get('host') ?? '';
  res.json({
    userId: user.userId,
    email: user.email ?? null,
    tenantId,
    serverOrigin: `${req.protocol}://${host}`,
    telecrmAppsConnected: countTelecrmAppsInTenant(tenantId),
    pendingCount,
  });
});

/** 접수 발주서 공개 링크 (SMS 치환용) */
router.get('/order-form-link', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const inquiryId = typeof req.query.inquiryId === 'string' ? req.query.inquiryId.trim() : '';
  if (!inquiryId) {
    res.status(400).json({ error: 'inquiryId가 필요합니다.' });
    return;
  }
  const origin =
    typeof req.query.origin === 'string' && req.query.origin.trim()
      ? req.query.origin.trim()
      : `${req.protocol}://${req.get('host') ?? ''}`;
  const url = await resolveTelecrmOrderFormLink(tenantId, inquiryId, origin);
  if (!url) {
    res.status(404).json({ error: '연결된 발주서 링크가 없습니다.' });
    return;
  }
  res.json({ url });
});

router.post('/call-sessions', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const parsed = parseCreateTelecrmCallSessionBody(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const row = await createTelecrmCallSession(tenantId, user.userId, parsed);
    res.status(201).json(serializeCallSessionRow(row));
  } catch (e) {
    if (e instanceof Error && e.message === 'INQUIRY_NOT_FOUND') {
      res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

router.post('/call-sessions/sync', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const parsed = parseSyncTelecrmCallSessionBody(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const row = await syncTelecrmCallSession(tenantId, user.userId, parsed);
    res.json(serializeCallSessionRow(row));
  } catch (e) {
    if (e instanceof Error && e.message === 'INQUIRY_NOT_FOUND') {
      res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

function parseYmdQuery(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : fallback;
}

function kstTodayYmd(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

router.get('/call-sessions/team-summary', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await userHasStaffAdminAccess(user))) {
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    return;
  }
  const today = kstTodayYmd();
  const from = parseYmdQuery(req.query.from, today);
  const to = parseYmdQuery(req.query.to, from);
  const summary = await getTelecrmCallSessionTeamSummary(tenantId, from, to);
  res.json(summary);
});

router.get('/call-sessions', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const today = kstTodayYmd();
  const from = parseYmdQuery(req.query.from, today);
  const to = parseYmdQuery(req.query.to, from);
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 30;
  const offsetRaw = typeof req.query.offset === 'string' ? Number.parseInt(req.query.offset, 10) : 0;
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 30;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
  const status =
    statusRaw === 'CONNECTED' || statusRaw === 'NO_ANSWER' || statusRaw === 'DIAL_ATTEMPT'
      ? (statusRaw as TelecrmCallSessionStatus)
      : undefined;
  const targetUserId =
    typeof req.query.userId === 'string' && req.query.userId.trim() ? req.query.userId.trim() : user.userId;
  if (targetUserId !== user.userId) {
    if (!(await userHasStaffAdminAccess(user))) {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
  }
  const result = await listTelecrmCallSessions(tenantId, {
    userId: targetUserId,
    fromYmd: from,
    toYmd: to,
    status,
    limit,
    offset,
    includeUser: targetUserId !== user.userId,
  });
  res.json(result);
});

router.get('/workdesk-stats', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const day =
    typeof req.query.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day.trim())
      ? req.query.day.trim()
      : new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const stats = await getTelecrmWorkdeskStats(tenantId, user.userId, day);
  res.json(stats);
});

router.get('/call-sessions/summary', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const day =
    typeof req.query.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day.trim())
      ? req.query.day.trim()
      : new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const summary = await getTelecrmCallSessionSummary(tenantId, user.userId, day);
  res.json(summary);
});

export const telecrmMobileRouter = router;
