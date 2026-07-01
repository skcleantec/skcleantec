import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireTelecrmTenant } from './telecrm.helpers.js';
import {
  createTelecrmCallSession,
  getTelecrmCallSessionSummary,
  parseCreateTelecrmCallSessionBody,
} from './telecrmCallSession.service.js';
import {
  drainTelecrmMobileDispatchQueue,
  enqueueTelecrmMobileDispatch,
  parseTelecrmMobileDispatchBody,
} from './telecrmMobileDispatch.service.js';
import { resolveTelecrmOrderFormLink } from './telecrmOrderLink.service.js';
import { getTelecrmWorkdeskStats } from './telecrmWorkdeskStats.service.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

/** Android 내부 앱 — 기능 플래그·최소 버전 (Play 심사 전 사무실 sideload용) */
router.get('/mobile-config', requireStaffPermission('crm.view', 'crm.settings'), async (_req, res) => {
  res.json({
    minAppVersion: '0.1.0',
    distribution: 'internal',
    features: {
      callSessions: true,
      smsDispatch: true,
      callRecording: false,
      pushNotifications: false,
    },
  });
});

/** PC CRM → 동일 마케터 휴대폰 앱 (통화·문자 큐) */
router.post('/mobile-dispatch', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const parsed = parseTelecrmMobileDispatchBody(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const item = enqueueTelecrmMobileDispatch(tenantId, user.userId, parsed);
  res.status(201).json({ ok: true, id: item.id, action: item.action });
});

/** 앱 재개·WS 누락 시 대기 중 dispatch 소비 */
router.get('/mobile-dispatch/pending', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const items = drainTelecrmMobileDispatchQueue(tenantId, user.userId);
  res.json({ items });
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
    res.status(201).json({
      id: row.id,
      phone: row.phone,
      direction: row.direction,
      durationSec: row.durationSec,
      customerMatch: row.customerMatch,
      inquiryId: row.inquiryId,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'INQUIRY_NOT_FOUND') {
      res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
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
