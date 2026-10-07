import { Router } from 'express';
import type { TenantPgOnboardingStatus } from '@prisma/client';
import { platformAuthMiddleware } from '../platform/platformAuth.middleware.js';
import { getPlatformCardFeeRates, savePlatformCardFeeRates } from './cardPayment.settings.service.js';
import {
  listOnboardingsForPlatform,
  updateOnboardingByPlatform,
} from './cardPaymentOnboarding.service.js';
import { saveCredentialFromPlatform } from './cardPaymentCredential.service.js';
import { platformCardPaymentSummary } from './cardPaymentList.service.js';
import { getCredentialPublic } from './cardPaymentCredential.service.js';
import { serviceBridgePublicStatus } from './serviceBridgeWspay.js';
import { probeTenantPaymentConnection } from './cardPaymentProbe.service.js';

const router = Router();
router.use(platformAuthMiddleware);

const ONBOARDING_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'FORWARDED_TO_PG',
  'APPROVED',
  'REJECTED',
] as const;

router.get('/settings', async (_req, res) => {
  const rates = await getPlatformCardFeeRates();
  const summary = await platformCardPaymentSummary();
  res.json({ ...rates, summary, serviceBridge: serviceBridgePublicStatus() });
});

router.put('/settings', async (req, res) => {
  const rates = await savePlatformCardFeeRates({
    tenantFeeBps: Number(req.body?.tenantFeeBps),
    platformCostBps: Number(req.body?.platformCostBps),
  });
  res.json(rates);
});

router.get('/onboardings', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : '';
  const status = ONBOARDING_STATUSES.includes(statusRaw as TenantPgOnboardingStatus)
    ? (statusRaw as TenantPgOnboardingStatus)
    : undefined;
  const result = await listOnboardingsForPlatform({ status, limit, offset });
  res.json(result);
});

router.patch('/onboardings/:tenantId', async (req, res) => {
  const status = String(req.body?.status ?? '') as TenantPgOnboardingStatus;
  if (!ONBOARDING_STATUSES.includes(status)) {
    res.status(400).json({ error: '상태를 확인해 주세요.' });
    return;
  }
  const row = await updateOnboardingByPlatform(String(req.params.tenantId), {
    status,
    platformMemo: typeof req.body?.platformMemo === 'string' ? req.body.platformMemo : null,
  });
  if (!row) {
    res.status(404).json({ error: '가입 신청이 없습니다.' });
    return;
  }
  res.json(row);
});

router.get('/credentials/:tenantId', async (req, res) => {
  const cred = await getCredentialPublic(String(req.params.tenantId));
  res.json(cred);
});

router.put('/credentials/:tenantId', async (req, res) => {
  try {
    const saved = await saveCredentialFromPlatform({
      tenantId: String(req.params.tenantId),
      apiKey: String(req.body?.apiKey ?? ''),
      tid: String(req.body?.tid ?? ''),
      mid: typeof req.body?.mid === 'string' ? req.body.mid : null,
      oid: typeof req.body?.oid === 'string' ? req.body.oid : null,
      webhookSecret: typeof req.body?.webhookSecret === 'string' ? req.body.webhookSecret : null,
    });
    res.json(saved);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '키를 저장하지 못했습니다.' });
  }
});

router.post('/credentials/:tenantId/probe', async (req, res) => {
  const probed = await probeTenantPaymentConnection(String(req.params.tenantId));
  if ('error' in probed) {
    res.status(probed.status).json({ error: probed.error });
    return;
  }
  res.json(probed.result);
});

export default router;
